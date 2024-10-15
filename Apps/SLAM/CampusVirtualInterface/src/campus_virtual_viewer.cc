#include "stella_vslam/system.h"
#include "stella_vslam/config.h"
#include "stella_vslam/camera/base.h"
#include "stella_vslam/util/yaml.h"

#ifdef HAVE_IRIDESCENCE_VIEWER
#include "iridescence_viewer/viewer.h"
#endif

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

#ifdef USE_STACK_TRACE_LOGGER
#include <backward.hpp>
#endif

#ifdef USE_GOOGLE_PERFTOOLS
#include <gperftools/profiler.h>
#endif

int send_map_to_socket(const std::shared_ptr<stella_vslam::system>& slam,
                  const std::shared_ptr<stella_vslam::config>& cfg,
                  const std::string& map_db_path) {

    // create a viewer object
    // and pass the frame_publisher and the map_publisher
    // std::shared_ptr<campus_virtual_socket_publisher::publisher> publisher;
    // publisher = std::make_shared<campus_virtual_socket_publisher::publisher>(
    // stella_vslam::util::yaml_optional_ref(cfg->yaml_node_, "SocketPublisher"),
    // slam,
    // slam->get_frame_publisher(),
    // slam->get_map_publisher());
#ifdef HAVE_IRIDESCENCE_VIEWER

    std::shared_ptr<iridescence_viewer::viewer> iridescence_viewer;
    iridescence_viewer = std::make_shared<iridescence_viewer::viewer>(
            stella_vslam::util::yaml_optional_ref(cfg->yaml_node_, "IridescenceViewer"),
            slam->get_frame_publisher(),
            slam->get_map_publisher());

#endif

    std::cout << "Starting editing session:" << std::endl;
    slam->enable_loop_detector();

    std::thread thread([&]() {
    int input1;
    int input2;
    std::cout << "Keyframe ID to loop closure (0 to exit):";
    std::cin >> input1;
    std::cout << "ID 2:";
    std::cin >> input2;
    while (input1 > 0 && input2 > 0){
        bool success = slam->request_loop_closure(input1, input2);
        std::cout << "Loop closure was: " << (success ? "SUCCESS" : "FAILED - Please wait for a previous loop closure to finish") << std::endl;

        std::cout << "Keyframe ID to loop closure (0 to exit):";
        std::cin >> input1;
        std::cout << "ID 2:";
        std::cin >> input2;
    }
    });

#ifdef HAVE_IRIDESCENCE_VIEWER
        iridescence_viewer->run();
#endif

    thread.join();

    std::cout << "Editing finished - Shutting down..." << std::endl;

    // shutdown the slam process
    slam->shutdown();

    if (!map_db_path.empty()) {
        if (!slam->save_map_database(map_db_path)) {
            return EXIT_FAILURE;
        }
    }

    return 0;
}

int main(int argc, char* argv[]) {
#ifdef USE_STACK_TRACE_LOGGER
    backward::SignalHandling sh;
#endif

    // create options
    popl::OptionParser op("Allowed options");
    auto help = op.add<popl::Switch>("h", "help", "produce help message");
    auto vocab_file_path = op.add<popl::Value<std::string>>("v", "vocab", "vocabulary file path");
    auto log_level = op.add<popl::Value<std::string>>("", "log-level", "log level", "info");
    auto config_file_path = op.add<popl::Value<std::string>>("c", "config", "config file path");

    auto map_db_path_in = op.add<popl::Value<std::string>>("i", "map-db-in", "load a map from this path", "");
    auto map_db_path_out = op.add<popl::Value<std::string>>("o", "map-db-out", "store a map database at this path after slam", "");

   
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

    // build a slam system
    auto slam = std::make_shared<stella_vslam::system>(cfg, vocab_file_path->value());
    bool need_initialize = true;
    // Load Map Database
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
    slam->disable_mapping_module();

    // run tracking
    double finish_timestamp = 0.0;
    if (slam->get_camera()->setup_type_ == stella_vslam::camera::setup_type_t::Monocular) {

        finish_timestamp = send_map_to_socket(slam,
                            cfg,
                            map_db_path_out->value());
    }
    else {
        throw std::runtime_error("Invalid setup type - must be Monocular: " + slam->get_camera()->get_setup_type_string());
    }
    std::cout << "Finish Timestamp" << finish_timestamp << std::endl;

#ifdef USE_GOOGLE_PERFTOOLS
    ProfilerStop();
#endif

    return 0;
}
