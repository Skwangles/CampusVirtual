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

#include <stdexcept>

#include <opencv2/core/mat.hpp>
#include <opencv2/core/types.hpp>
#include <opencv2/imgcodecs.hpp>
#include <opencv2/videoio.hpp>
#include <spdlog/spdlog.h>
#include <popl.hpp>

#include <pqxx/pqxx>
#include <string>

#include "util/save_to_db.hpp"

#include <sqlite3.h>


#include <ghc/filesystem.hpp>
namespace fs = ghc::filesystem;

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
            ts NUMERIC NOT NULL,
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

    txn.exec(R"(
        CREATE TABLE IF NOT EXISTS node_locations (
            id SERIAL PRIMARY KEY,
            keyframe_id INTEGER UNIQUE NOT NULL,
            location TEXT,
            FOREIGN KEY (keyframe_id) REFERENCES nodes(keyframe_id)
        );
    )");

    txn.exec("TRUNCATE TABLE node_locations, nodes, edges RESTART IDENTITY;");
        
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

void timestamp_groups_to_pg(pqxx::work &txn, const std::string& map_db_path){


    sqlite3* db = nullptr;
    int ret = sqlite3_open(map_db_path.c_str(), &db);
    if (ret != SQLITE_OK) {
        spdlog::error("Failed to open SQL database");
        return;
    }

    auto node_locations = load_timestamp_groups(db);

    for (const timestamp_group& node_loc : node_locations){
        pqxx::result res = txn.exec_params("SELECT keyframe_id FROM nodes WHERE ABS(ts - $1) < 0.00001 LIMIT 1", node_loc.timestamp);
        if (std::size(res) == 0){
            std::cout << "Could not find a timestamp match for " << node_loc.timestamp << " of group " << node_loc.group << std::endl;
            continue;
        }
        const int id = res[0]["keyframe_id"].as<int>();
        std::cout << "Paired ts " << node_loc.timestamp << " with keyframe_id " << id << std::endl;
        txn.exec_params("INSERT INTO node_locations (keyframe_id, location) VALUES ($1, $2)", id, node_loc.group);
    }

    sqlite3_close(db);
}

void convert_to_pg(const std::shared_ptr<stella_vslam::system>& slam,
                       const std::shared_ptr<stella_vslam::config>& cfg,
                       const std::string& map_db_path,
                       const std::string& postgres_connection_string) {

    // Connect to the PostgreSQL database
    pqxx::connection conn(postgres_connection_string);

    if (!conn.is_open()){
        std::cout << "Cannot open database" << std::endl;
        throw std::invalid_argument("Database connection string could not create a connection to the database.");
    }

    std::cout << "Connected to database" << std::endl;
    
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
        const auto ts = keyfrm->timestamp_;
        const auto pose = keyfrm->get_pose_cw();

        // Insert keyframe into the database
        std::vector<double> pose_vec;
        for (int i = 0; i < 16; i++) {
            int ir = i / 4;
            int il = i % 4;
            pose_vec.push_back(pose(ir, il));
        }
        txn.exec_params("INSERT INTO nodes (keyframe_id, ts, pose) VALUES ($1, $2, $3) ON CONFLICT (keyframe_id) DO UPDATE SET ts = EXCLUDED.ts , pose = EXCLUDED.pose",
                        id, ts, vector_to_pg_array(pose_vec));
    }

    for (const auto& keyfrm : keyfrms) {
            if (!keyfrm || keyfrm->will_be_erased()) {
                continue;
            }

        const unsigned int keyfrm_id = keyfrm->id_;
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


         // Spanning tree
        auto spanning_parent = keyfrm->graph_node_->get_spanning_parent();
        if (spanning_parent) {
            txn.exec_params("INSERT INTO edges (keyframe_id0, keyframe_id1, is_direct) VALUES ($1, $2, true) ON CONFLICT (keyframe_id0, keyframe_id1) DO NOTHING",
                            keyfrm_id, spanning_parent->id_);
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

        const auto loop_edges = keyfrm->graph_node_->get_loop_edges();
        if (!loop_edges.empty()) {
            for (const auto& loop : loop_edges) {
                if (!loop || loop->will_be_erased()) {
                    continue;
                }
                txn.exec_params("INSERT INTO edges (keyframe_id0, keyframe_id1, is_direct) VALUES ($1, $2, false) ON CONFLICT (keyframe_id0, keyframe_id1) DO NOTHING",
                                keyfrm_id, loop->id_);
            }
        }

    }

    

    timestamp_groups_to_pg(txn, map_db_path);

    txn.commit();

    conn.disconnect();
 
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
