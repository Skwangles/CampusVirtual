#include "campus_virtual_socket_publisher/publisher.h"

#include "stella_vslam/system.h"
#include "stella_vslam/config.h"
#include "stella_vslam/camera/base.h"
#include "stella_vslam/publish/map_publisher.h"
#include "stella_vslam/util/yaml.h"
#include "stella_vslam/data/keyframe.h"
// #include "stella_vslam/data/keyframe.h"

#include <iostream>
#include <chrono>
#include <fstream>
#include <numeric>
#include <pqxx/pqxx> 
#include <memory>
#include <vector>
#include <unordered_map>
#include <forward_list>

#include <opencv2/core/mat.hpp>
#include <opencv2/core/types.hpp>
#include <opencv2/imgcodecs.hpp>
#include <opencv2/videoio.hpp>
#include <spdlog/spdlog.h>
#include <popl.hpp>

#include <iostream>
#include <pqxx/pqxx>
#include <string>


#include <ghc/filesystem.hpp>
namespace fs = ghc::filesystem;

#include "save_filenames_to_db.hpp"

#ifdef USE_STACK_TRACE_LOGGER
#include <backward.hpp>
#endif

#ifdef USE_GOOGLE_PERFTOOLS
#include <gperftools/profiler.h>
#endif

// Function to create necessary tables in PostgreSQL
void create_tables_if_not_exist(pqxx::connection& conn) {
    pqxx::work txn(conn);

    txn.exec(R"(
        CREATE TABLE IF NOT EXISTS nodes (
            id SERIAL PRIMARY KEY,
            keyframe_id INTEGER UNIQUE NOT NULL,
            pose DOUBLE PRECISION[] NOT NULL
        );
    )");

    txn.exec(R"(
        CREATE TABLE IF NOT EXISTS edges (
            id SERIAL PRIMARY KEY,
            keyframe_id0 INTEGER NOT NULL,
            keyframe_id1 INTEGER NOT NULL,
            is_direct BOOLEAN DEFAULT false,
            FOREIGN KEY (keyframe_id0) REFERENCES nodes(keyframe_id),
            FOREIGN KEY (keyframe_id1) REFERENCES nodes(keyframe_id),
            CONSTRAINT unique_edge UNIQUE (keyframe_id0, keyframe_id1)
        );
    )");

    txn.exec("TRUNCATE TABLE nodes, edges RESTART IDENTITY;");
        
    // Commit the transaction
    txn.commit();
}

std::string vector_to_pg_array(std::vector<double>& mat) {
    std::stringstream ss;
    bool is_first = true;
    ss << "{";
    for(const double& d : mat) {
        if (!is_first){
            ss << ",";
        }
        is_first = false;

        ss << d;
    }
    ss << "}";
    return ss.str();
}

void convert_to_pg(const std::shared_ptr<stella_vslam::system>& slam,
                       const std::shared_ptr<stella_vslam::config>& cfg,
                       const std::string& map_db_path,
                       const std::string& postgres_connection_string) {

    // Connect to the PostgreSQL database
    pqxx::connection conn(postgres_connection_string);
    
    // Create necessary tables if they don't exist
    create_tables_if_not_exist(conn);

    pqxx::work txn(conn);

    // 1. Keyframe registration
    int64 count = 0;
    std::vector<std::shared_ptr<stella_vslam::data::keyframe>> keyfrms;
    slam->get_map_publisher()->get_keyframes(keyfrms);

    for (const auto& keyfrm : keyfrms) {
        if (!keyfrm || keyfrm->will_be_erased()) {
            continue;
        }

        const auto id = keyfrm->id_;
        const auto pose = keyfrm->get_pose_cw();

        // Insert keyframe into the database
        std::vector<double> pose_vec;
        for (int i = 0; i < 16; i++) {
            int ir = i / 4;
            int il = i % 4;
            pose_vec.push_back(pose(ir, il));
        }
        txn.exec_params("INSERT INTO nodes (keyframe_id, pose) VALUES ($1, $2) ON CONFLICT (keyframe_id) DO UPDATE SET pose = EXCLUDED.pose",
                        id, vector_to_pg_array(pose_vec));

        count++;
    }

    // 2. Graph registration
    for (const auto& keyfrm : keyfrms) {
        if (!keyfrm || keyfrm->will_be_erased()) {
            continue;
        }

        const unsigned int keyfrm_id = keyfrm->id_;

         // Spanning tree
        auto spanning_parent = keyfrm->graph_node_->get_spanning_parent();
        if (spanning_parent) {
            txn.exec_params("INSERT INTO edges (keyframe_id0, keyframe_id1, is_direct) VALUES ($1, $2, true) ON CONFLICT (keyframe_id0, keyframe_id1) DO NOTHING",
                            keyfrm_id, spanning_parent->id_);
        }

        auto spanning_children = keyfrm->graph_node_->get_spanning_children();
        if (!spanning_children.empty()) {
            for (const auto& child : spanning_children) {
                if (!child || child->will_be_erased()) {
                    continue;
                }
                txn.exec_params("INSERT INTO edges (keyframe_id0, keyframe_id1, is_direct) VALUES ($1, $2, true) ON CONFLICT (keyframe_id0, keyframe_id1) DO NOTHING",
                                keyfrm_id, child->id_);
            }
        }


        // Covisibility graph
        const auto covisibilities = keyfrm->graph_node_->get_covisibilities_over_min_num_shared_lms(100);
        if (!covisibilities.empty()) {
            for (const auto& covisibility : covisibilities) {
                if (!covisibility || covisibility->will_be_erased()) {
                    continue;
                }
                txn.exec_params("INSERT INTO edges (keyframe_id0, keyframe_id1, is_direct) VALUES ($1, $2, false) ON CONFLICT (keyframe_id0, keyframe_id1) DO NOTHING",
                                keyfrm_id, covisibility->id_);
            }
        }

    }
 
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


    convert_to_pg(slam, cfg, map_db_path_in->value(), postgres_connection->value());

    slam->shutdown();

    return 0;
}
