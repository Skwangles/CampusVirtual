#include "campus_virtual_socket_publisher/publisher.h"

#include "stella_vslam/system.h"
#include "stella_vslam/config.h"
#include "stella_vslam/camera/base.h"
#include "stella_vslam/publisher/map_publisher.h"
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

#ifdef USE_STACK_TRACE_LOGGER
#include <backward.hpp>
#endif

#ifdef USE_GOOGLE_PERFTOOLS
#include <gperftools/profiler.h>
#endif

int send_map_to_socket(const std::shared_ptr<stella_vslam::system>& slam,
                  const std::shared_ptr<stella_vslam::config>& cfg,
                  const std::string& map_db_path, const std::string& postgres_connection_string) {


    std::forward_list<map_segment::map_keyframe*> allocated_keyframes;

    // 1. keyframe registration

    int64 count = 0;
    std::vector<std::shared_ptr<stella_vslam::data::keyframe>> keyfrms = slam->get_map_publisher()->get_keyframes();

    std::unordered_map<unsigned int, double> next_keyframe_hash_map;
    for (const auto& keyfrm : keyfrms) {
        if (!keyfrm || keyfrm->will_be_erased()) {
            continue;
        }

        if (count > max_number_of_keyframes_per_socket_message) {zzz
                continue;
        }

        const auto id = keyfrm->id_;
        const auto pose = keyfrm->get_pose_cw();
        const auto pose_hash = get_mat_hash(pose); // get zipped code (likely hash)

       

        next_keyframe_hash_map[id] = pose_hash;

        // check whether the "point" has already been send.
        // and remove it from "keyframe_zip".
        if (keyframe_hash_map_->count(id) != 0) {
            if (keyframe_hash_map_->at(id) == pose_hash){
                keyframe_hash_map_->erase(id);
                continue;
            }
            keyframe_hash_map_->erase(id);
        }

        

        auto keyfrm_obj = map.add_keyframes();
        keyfrm_obj->set_id(keyfrm->id_);
        map_segment::map_Mat44* pose_obj = new map_segment::map_Mat44();
        for (int i = 0; i < 16; i++) {
            int ir = i / 4;
            int il = i % 4;
            pose_obj->add_pose(pose(ir, il));
        }
        keyfrm_obj->set_allocated_pose(pose_obj);
        allocated_keyframes.push_front(keyfrm_obj);
        count++;
    }
    // add removed keyframes.
    for (const auto& itr : *keyframe_hash_map_) {
        const auto id = itr.first;

        auto keyfrm_obj = map.add_keyframes();
        keyfrm_obj->set_id(id);
    }

    *keyframe_hash_map_ = next_keyframe_hash_map;

    // 2. graph registration
    for (const auto& keyfrm : keyfrms) {
        if (!keyfrm || keyfrm->will_be_erased()) {
            continue;
        }

        const unsigned int keyfrm_id = keyfrm->id_;

        // covisibility graph
        const auto covisibilities = keyfrm->graph_node_->get_covisibilities_over_min_num_shared_lms(100);
        if (!covisibilities.empty()) {
            for (const auto& covisibility : covisibilities) {
                if (!covisibility || covisibility->will_be_erased()) {
                    continue;
                }
                if (covisibility->id_ < keyfrm_id) {
                    continue;
                }
                const auto edge_obj = map.add_edges();
                edge_obj->set_id0(keyfrm_id);
                edge_obj->set_id1(covisibility->id_);
            }
        }

        // spanning tree
        auto spanning_parent = keyfrm->graph_node_->get_spanning_parent();
        if (spanning_parent) {
            const auto edge_obj = map.add_edges();
            edge_obj->set_id0(keyfrm_id);
            edge_obj->set_id1(spanning_parent->id_);
        }

        // loop edges
        const auto loop_edges = keyfrm->graph_node_->get_loop_edges();
        for (const auto& loop_edge : loop_edges) {
            if (!loop_edge) {
                continue;
            }
            if (loop_edge->id_ < keyfrm_id) {
                continue;
            }
            const auto edge_obj = map.add_edges();
            edge_obj->set_id0(keyfrm_id);
            edge_obj->set_id1(loop_edge->id_);
        }
    }

    // 3. landmark registration

    std::unordered_map<unsigned int, double> next_point_hash_map;
    for (const auto& landmark : all_landmarks) {
        if (!landmark || landmark->will_be_erased()) {
            continue;
        }

        const auto id = landmark->id_;
        const auto pos = landmark->get_pos_in_world();
        const auto zip = get_vec_hash(pos);

        // point exists on next_point_zip.
        next_point_hash_map[id] = zip;

        // remove point from point_zip.
        if (point_hash_map_->count(id) != 0) {
            if (point_hash_map_->at(id) == zip) {
                point_hash_map_->erase(id);
                continue;
            }
            point_hash_map_->erase(id);
        }
        const unsigned int rgb[] = {0, 0, 0};

        // add to protocol buffers
        auto landmark_obj = map.add_landmarks();
        landmark_obj->set_id(id);
        for (int i = 0; i < 3; i++) {
            landmark_obj->add_coords(pos[i]);
        }
        for (int i = 0; i < 3; i++) {
            landmark_obj->add_color(rgb[i]);
        }
    }
    // removed points are remaining in "point_zips".
    for (const auto& itr : *point_hash_map_) {
        const auto id = itr.first;

        auto landmark_obj = map.add_landmarks();
        landmark_obj->set_id(id);
    }
    *point_hash_map_ = next_point_hash_map;

    // 4. local landmark registration

    for (const auto& landmark : local_landmarks) {
        map.add_local_landmarks(landmark->id_);
    }


    std::string buffer;
    map.SerializeToString(&buffer);

    for (const auto keyfrm_obj : allocated_keyframes) {
        keyfrm_obj->clear_pose();
    }

    const auto* cstr = reinterpret_cast<const unsigned char*>(buffer.c_str());
    return base64_encode(cstr, buffer.length());
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
    auto postgres_connection = op.add<popl::Value<std::string>>("d", "db", "postgres connection string", "postgresql://test:test@localhost:5432/campusvirtual");

   
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


    convert_to_pg(slam, cfg, map_db_path_out->value(), postgres_connection->value());

#ifdef USE_GOOGLE_PERFTOOLS
    ProfilerStop();
#endif

    return 0;
}
