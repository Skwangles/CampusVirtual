#ifdef HAVE_PANGOLIN_VIEWER
#include "pangolin_viewer/viewer.h"
#endif
#ifdef HAVE_IRIDESCENCE_VIEWER
#include "iridescence_viewer/viewer.h"
#endif

#include "stella_vslam/system.h"
#include "stella_vslam/config.h"
#include "stella_vslam/camera/base.h"
#include "stella_vslam/util/yaml.h"

#include <iostream>
#include <chrono>
#include <fstream>
#include <numeric>

#include <opencv2/core/mat.hpp>
#include <opencv2/core/types.hpp>
#include <opencv2/imgcodecs.hpp>
#include <opencv2/videoio.hpp>
#include <spdlog/spdlog.h>
#include <popl.hpp>

#include <ghc/filesystem.hpp>
namespace fs = ghc::filesystem;

#include "save_filenames_to_db.hpp"
#include "video_timestamp.hpp"

#ifdef USE_STACK_TRACE_LOGGER
#include <backward.hpp>
#endif

#ifdef USE_GOOGLE_PERFTOOLS
#include <gperftools/profiler.h>
#endif

static int db_callback(std::vector<video_timestamp> *data, int argc, char **argv, char **azColName){
   data->push_back(video_timestamp(argv[0], std::atof(argv[1]), std::atof(argv[2])));
   return 0;
}

int mono_tracking(const std::shared_ptr<stella_vslam::system>& slam,
                  const std::shared_ptr<stella_vslam::config>& cfg,
                  const std::string& video_file_path,
                  const std::string& mask_img_path,
                  const unsigned int frame_skip,
                  const unsigned int start_time,
                  const bool no_sleep,
                  const bool wait_loop_ba,
                  const bool auto_term,
                  const std::string& eval_log_dir,
                  const std::string& map_db_path,
                  const double start_timestamp,
                  const std::string& viewer_string,
                  const std::string& image_output_dir = "pictures/"
                  ) {
    // load the mask image
    const cv::Mat mask = mask_img_path.empty() ? cv::Mat{} : cv::imread(mask_img_path, cv::IMREAD_GRAYSCALE);

    // create a viewer object
    // and pass the frame_publisher and the map_publisher
#ifdef HAVE_PANGOLIN_VIEWER
    std::shared_ptr<pangolin_viewer::viewer> viewer;
    if (viewer_string == "pangolin_viewer") {
        viewer = std::make_shared<pangolin_viewer::viewer>(
            stella_vslam::util::yaml_optional_ref(cfg->yaml_node_, "PangolinViewer"),
            slam,
            slam->get_frame_publisher(),
            slam->get_map_publisher());
    }
#endif
#ifdef HAVE_IRIDESCENCE_VIEWER
    std::shared_ptr<iridescence_viewer::viewer> iridescence_viewer;
    std::mutex mtx_pause;
    bool is_paused = false;
    std::mutex mtx_terminate;
    bool terminate_is_requested = false;
    std::mutex mtx_step;
    unsigned int step_count = 0;
    if (viewer_string == "iridescence_viewer") {
        iridescence_viewer = std::make_shared<iridescence_viewer::viewer>(
            stella_vslam::util::yaml_optional_ref(cfg->yaml_node_, "IridescenceViewer"),
            slam->get_frame_publisher(),
            slam->get_map_publisher());
        iridescence_viewer->add_checkbox("Pause", [&is_paused, &mtx_pause](bool check) {
            std::lock_guard<std::mutex> lock(mtx_pause);
            is_paused = check;
        });
        iridescence_viewer->add_button("Step", [&step_count, &mtx_step] {
            std::lock_guard<std::mutex> lock(mtx_step);
            step_count++;
        });
        iridescence_viewer->add_button("Reset", [&is_paused, &mtx_pause, &slam] {
            slam->request_reset();
        });
        iridescence_viewer->add_button("Save and exit", [&is_paused, &mtx_pause, &terminate_is_requested, &mtx_terminate, &slam, &iridescence_viewer] {
            std::lock_guard<std::mutex> lock1(mtx_pause);
            is_paused = false;
            std::lock_guard<std::mutex> lock2(mtx_terminate);
            terminate_is_requested = true;
            iridescence_viewer->request_terminate();
        });
        iridescence_viewer->add_close_callback([&is_paused, &mtx_pause, &terminate_is_requested, &mtx_terminate] {
            std::lock_guard<std::mutex> lock1(mtx_pause);
            is_paused = false;
            std::lock_guard<std::mutex> lock2(mtx_terminate);
            terminate_is_requested = true;
        });
    }
#endif

    auto video = cv::VideoCapture(video_file_path, cv::CAP_FFMPEG);
    if (!video.isOpened()) {
        std::cerr << "Unable to open the video." << std::endl;
        return EXIT_FAILURE;
    }
    video.set(0, start_time);
    std::vector<double> track_times;

    cv::Mat frame;

    unsigned int num_frame = 0;
    double timestamp = start_timestamp;

    bool is_not_end = true;
    // run the slam in another thread
    std::thread thread([&]() {
        while (is_not_end) {
#ifdef HAVE_IRIDESCENCE_VIEWER
            while (true) {
                {
                    std::lock_guard<std::mutex> lock(mtx_pause);
                    if (!is_paused) {
                        break;
                    }
                }
                {
                    std::lock_guard<std::mutex> lock(mtx_step);
                    if (step_count > 0) {
                        step_count--;
                        break;
                    }
                }
                std::this_thread::sleep_for(std::chrono::microseconds(5000));
            }
#endif

            // wait until the loop BA is finished
            if (wait_loop_ba) {
                while (slam->loop_BA_is_running() || !slam->mapping_module_is_enabled()) {
                    std::this_thread::sleep_for(std::chrono::milliseconds(100));
                }
            }

            is_not_end = video.read(frame);

            const auto tp_1 = std::chrono::steady_clock::now();

            if (!frame.empty() && (num_frame % frame_skip == 0)) {
                // input the current frame and estimate the camera pose
                if (slam->feed_monocular_frame_bool(frame, timestamp, mask) && !image_output_dir.empty()){
                    cv::imwrite(image_output_dir +  std::to_string(timestamp) + ".png", frame);
                }
            }

            const auto tp_2 = std::chrono::steady_clock::now();

            const auto track_time = std::chrono::duration_cast<std::chrono::duration<double>>(tp_2 - tp_1).count();
            if (num_frame % frame_skip == 0) {
                track_times.push_back(track_time);
            }

            // wait until the timestamp of the next frame
            if (!no_sleep) {
                const auto wait_time = 1.0 / slam->get_camera()->fps_ - track_time;
                if (0.0 < wait_time) {
                    std::this_thread::sleep_for(std::chrono::microseconds(static_cast<unsigned int>(wait_time * 1e6)));
                }
            }

            timestamp += 1.0 / slam->get_camera()->fps_;
            ++num_frame;

#ifdef HAVE_IRIDESCENCE_VIEWER
            // check if the termination of slam system is requested or not
            {
                std::lock_guard<std::mutex> lock(mtx_terminate);
                if (terminate_is_requested) {
                    break;
                }
            }
#else
            // check if the termination of slam system is requested or not
            if (slam->terminate_is_requested()) {
                break;
            }
#endif
        }

        // wait until the loop BA is finished
        while (slam->loop_BA_is_running()) {
            std::this_thread::sleep_for(std::chrono::microseconds(5000));
        }

        // automatically close the viewer
        if (auto_term) {
            if (viewer_string == "pangolin_viewer") {
#ifdef HAVE_PANGOLIN_VIEWER
                viewer->request_terminate();
#endif
            }
            if (viewer_string == "iridescence_viewer") {
#ifdef HAVE_IRIDESCENCE_VIEWER
                iridescence_viewer->request_terminate();
#endif
            }
        }
    });

    // run the viewer in the current thread
    if (viewer_string == "pangolin_viewer") {
#ifdef HAVE_PANGOLIN_VIEWER
        viewer->run();
#endif
    }
    if (viewer_string == "iridescence_viewer") {
#ifdef HAVE_IRIDESCENCE_VIEWER
        iridescence_viewer->run();
#endif
    }

    thread.join();

    // shutdown the slam process
    slam->shutdown();

    if (!eval_log_dir.empty()) {
        // output the trajectories for evaluation
        slam->save_frame_trajectory(eval_log_dir + "/frame_trajectory.txt", "TUM");
        slam->save_keyframe_trajectory(eval_log_dir + "/keyframe_trajectory.txt", "TUM");
        // output the tracking times for evaluation
        std::ofstream ofs(eval_log_dir + "/track_times.txt", std::ios::out);
        if (ofs.is_open()) {
            for (const auto track_time : track_times) {
                ofs << track_time << std::endl;
            }
            ofs.close();
        }
    }

    std::sort(track_times.begin(), track_times.end());
    const auto total_track_time = std::accumulate(track_times.begin(), track_times.end(), 0.0);
    std::cout << "median tracking time: " << track_times.at(track_times.size() / 2) << "[s]" << std::endl;
    std::cout << "mean tracking time: " << total_track_time / track_times.size() << "[s]" << std::endl;

    if (!map_db_path.empty()) {
        if (!slam->save_map_database(map_db_path)) {
            return EXIT_FAILURE;
        }
    }

    return timestamp;
}

int main(int argc, char* argv[]) {
    int ret;
    sqlite3* db = nullptr;
#ifdef USE_STACK_TRACE_LOGGER
    backward::SignalHandling sh;
#endif

    // create options
    popl::OptionParser op("Allowed options");
    auto help = op.add<popl::Switch>("h", "help", "produce help message");
    auto vocab_file_path = op.add<popl::Value<std::string>>("v", "vocab", "vocabulary file path");
   
    auto config_file_path = op.add<popl::Value<std::string>>("c", "config", "config file path");
    auto mask_img_path = op.add<popl::Value<std::string>>("", "mask", "mask image path", "");
    auto frame_skip = op.add<popl::Value<unsigned int>>("", "frame-skip", "interval of frame skip", 1);
    auto start_time = op.add<popl::Value<unsigned int>>("s", "start-time", "time to start playing [milli seconds]", 0);
    auto no_sleep = op.add<popl::Switch>("", "no-sleep", "not wait for next frame in real time");
    auto wait_loop_ba = op.add<popl::Switch>("", "wait-loop-ba", "wait until the loop BA is finished");
    auto log_level = op.add<popl::Value<std::string>>("", "log-level", "log level", "info");
    auto eval_log_dir = op.add<popl::Value<std::string>>("", "eval-log-dir", "store trajectory and tracking times at this path (Specify the directory where it exists.)", "");
    auto map_db_path_in = op.add<popl::Value<std::string>>("i", "map-db-in", "load a map from this path", "");
    auto map_db_path_out = op.add<popl::Value<std::string>>("o", "map-db-out", "store a map database at this path after slam", "");
    auto disable_mapping = op.add<popl::Switch>("", "disable-mapping", "disable mapping");
    auto temporal_mapping = op.add<popl::Switch>("", "temporal-mapping", "enable temporal mapping");
    auto start_timestamp = op.add<popl::Value<double>>("t", "start-timestamp", "timestamp of the start of the very first video (e.g. unique timestamp where the last video ended)");
    auto viewer = op.add<popl::Value<std::string>>("", "viewer", "viewer [iridescence_viewer, pangolin_viewer, socket_publisher, none]");

    auto videos = op.add<popl::Value<std::string>>("", "videos", "set of comma separated videos files to process (e.g. g-block.mp4,g-block2.mp4)");
    auto video_dir = op.add<popl::Value<std::string>>("", "video-dir", "directory containing video files, if not set must be part of the videos option");
    
   
    try {
        op.parse(argc, argv);
    }
    catch (const std::exception& e) {
        std::cerr << e.what() << std::endl;
        std::cerr << std::endl;
        std::cerr << op << std::endl;
        return EXIT_FAILURE;
    }

     // check validness of options
    if (help->is_set()) {
        std::cerr << op << std::endl;
        return EXIT_FAILURE;
    }
    if (!op.unknown_options().empty()) {
        for (const auto& unknown_option : op.unknown_options()) {
            std::cerr << "unknown_options: " << unknown_option << std::endl;
        }
        std::cerr << op << std::endl;
        return EXIT_FAILURE;
    }
    if (!vocab_file_path->is_set() || !config_file_path->is_set()) {
        std::cerr << "invalid arguments" << std::endl;
        std::cerr << std::endl;
        std::cerr << op << std::endl;
        return EXIT_FAILURE;
    }

    // viewer
    std::string viewer_string;
    if (viewer->is_set()) {
        viewer_string = viewer->value();
        if (viewer_string != "pangolin_viewer"
            && viewer_string != "iridescence_viewer"
            && viewer_string != "none") {
            std::cerr << "invalid arguments (--viewer)" << std::endl
                      << std::endl
                      << op << std::endl;
            return EXIT_FAILURE;
        }
#ifndef HAVE_PANGOLIN_VIEWER
        if (viewer_string == "pangolin_viewer") {
            std::cerr << "pangolin_viewer not linked" << std::endl
                      << std::endl
                      << op << std::endl;
            return EXIT_FAILURE;
        }
#endif
#ifndef HAVE_IRIDESCENCE_VIEWER
        if (viewer_string == "iridescence_viewer") {
            std::cerr << "iridescence_viewer not linked" << std::endl
                      << std::endl
                      << op << std::endl;
            return EXIT_FAILURE;
        }
#endif
    }
    else {
#ifdef HAVE_IRIDESCENCE_VIEWER
        viewer_string = "iridescence_viewer";
#elif defined(HAVE_PANGOLIN_VIEWER)
        viewer_string = "pangolin_viewer";
#endif
    }

    // setup logger
    spdlog::set_pattern("[%Y-%m-%d %H:%M:%S.%e] %^[%L] %v%$");
    spdlog::set_level(spdlog::level::from_str(log_level->value()));

    // load configuration
    std::shared_ptr<stella_vslam::config> cfg;
    try {
        cfg = std::make_shared<stella_vslam::config>(config_file_path->value());
    }
    catch (const std::exception& e) {
        std::cerr << e.what() << std::endl;
        return EXIT_FAILURE;
    }

#ifdef USE_GOOGLE_PERFTOOLS
    ProfilerStart("slam.prof");
#endif

    std::string map_db_in = map_db_path_in->value();

    db = nullptr;
    ret = sqlite3_open(map_db_in.c_str(), &db);
    if (ret != SQLITE_OK) {
        spdlog::error("Failed to open SQL database");
        return false;
    }

    std::vector<video_timestamp> video_timestamps_list = load_video_timestamps(db);

    sqlite3_close(db);

    std::string video_file_path;

    // You cannot get timestamps of images with this input format.
    // It is recommended to specify the timestamp when the video recording was started in Unix time.
    // If not specified, the current system time is used instead.

    double timestamp = 0.0;
    if (!start_timestamp->is_set()) {
            std::cerr << "--start-timestamp is not set. using system timestamp." << std::endl;
            if (no_sleep->is_set()) {
                std::cerr << "If --no-sleep is set without --start-timestamp, timestamps may overlap between multiple runs." << std::endl;
            }
            std::chrono::system_clock::time_point start_time_system = std::chrono::system_clock::now();
            timestamp = std::chrono::duration_cast<std::chrono::duration<double>>(start_time_system.time_since_epoch()).count();
        }
    else {
            timestamp = start_timestamp->value();
    } 


    

    for (const auto& video_file : stella_vslam::util::split_string(videos->value(), ',')) {
        if (video_dir->is_set()) {
             video_file_path = fs::path(video_dir->value()).string() + "/" + video_file;
        }
        else {
            video_file_path = video_file;
        }
        std::cout << "Processing video: " << video_file_path << std::endl;

        // build a slam system
        auto slam = std::make_shared<stella_vslam::system>(cfg, vocab_file_path->value());
        bool need_initialize = true;
        if (!map_db_in.empty()) {
            need_initialize = false;
            const auto path = fs::path(map_db_in);
            if (path.extension() == ".yaml") {
                YAML::Node node = YAML::LoadFile(path);
                for (const auto& map_path : node["maps"].as<std::vector<std::string>>()) {
                    if (!slam->load_map_database(path.parent_path() / map_path)) {
                        return EXIT_FAILURE;
                    }
                }
            }
            else {
                if (!slam->load_map_database(path)) {
                    return EXIT_FAILURE;
                }
            }
        }
        slam->startup(need_initialize);
        if (disable_mapping->is_set()) {
            slam->disable_mapping_module();
        }
        else if (temporal_mapping->is_set()) {
            slam->enable_temporal_mapping();
            slam->disable_loop_detector();
        }

        // run tracking
        double finish_timestamp = 0.0;
        if (slam->get_camera()->setup_type_ == stella_vslam::camera::setup_type_t::Monocular) {
            finish_timestamp = mono_tracking(slam,
                                cfg,
                                video_file_path,
                                mask_img_path->value(),
                                frame_skip->value(),
                                start_time->value(),
                                no_sleep->is_set(),
                                wait_loop_ba->is_set(),
                                true /* Video loop should always autoterm*/,
                                eval_log_dir->value(),
                                map_db_path_out->value(),
                                timestamp,
                                viewer_string, 
                                "pictures/");
        }
        else {
            throw std::runtime_error("Invalid setup type: " + slam->get_camera()->get_setup_type_string());
        }
        std::cout << "Finish Timestamp" << finish_timestamp << std::endl;

        video_timestamps_list.emplace_back(video_file_path, timestamp, finish_timestamp);
        
        timestamp = finish_timestamp + 1;
        std::cout << "Map database is saved to " << map_db_path_out->value() << std::endl;

        map_db_in = map_db_path_out->value(); // Running in a loop, must build on previous video maps
    }


    db = nullptr;
    ret = sqlite3_open(map_db_path_out->value().c_str(), &db);
    if (ret != SQLITE_OK) {
        spdlog::error("Failed to open SQL database");
        return 1;
    }
        
    for (auto& video_timestamp : video_timestamps_list) {
        save_video_to_db(db, video_timestamp.name , video_timestamp.start_timestamp, video_timestamp.stop_timestamp);
        std::cout << "Video: " << video_timestamp.name << " Start: " << video_timestamp.start_timestamp << " End: " << video_timestamp.stop_timestamp << std::endl;
    }

    sqlite3_close(db);
    


#ifdef USE_GOOGLE_PERFTOOLS
    ProfilerStop();
#endif

    return 0;
}
