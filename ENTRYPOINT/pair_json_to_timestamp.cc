#include "sqlite3.h"
#include <iostream>
#include <pqxx/pqxx>
#include <boost/program_options.hpp>
#include <fstream>
#include "include/json.hpp"  // nlodmann/json library

namespace po = boost::program_options;


void create_tables_if_not_exist(pqxx::connection &conn) {
    pqxx::work txn(conn);

    txn.exec(R"(
        CREATE TABLE IF NOT EXISTS node_location (
            id SERIAL PRIMARY KEY,
            ts NUMERIC NOT NULL,
            keyframe_id INTEGER UNIQUE NOT NULL,
            group_id VARCHAR(256)
        );
    )");
    txn.exec("TRUNCATE TABLE node_location RESTART IDENTITY;");

    // Commit the transaction
    txn.commit();
}

int main(int argc, char *argv[]) {
    // create options
    po::options_description desc("Allowed options");
    desc.add_options()
        ("help,h", "produce help message")
        ("map-db-in,i", po::value<std::string>()->required(), "load a map from this path")
        ("json_dir,j", po::value<std::string>()->required(), "json_dir")
        ("db,d", po::value<std::string>()->required(), "postgres connection string");

    po::variables_map vm;

    try {
        po::store(po::parse_command_line(argc, argv, desc), vm);
        po::notify(vm);
    } catch (const std::exception &e) {
        std::cerr << e.what() << std::endl;
        std::cerr << desc << std::endl;
        return EXIT_FAILURE;
    }

    if (vm.count("help")) {
        std::cerr << desc << std::endl;
        return EXIT_FAILURE;
    }

    std::string map_db_path_in = vm["map-db-in"].as<std::string>();
    std::string json_dir = vm["json_dir"].as<std::string>();
    std::string postgres_connection = vm["db"].as<std::string>();

    sqlite3 *db;
    int rc;

    rc = sqlite3_open(map_db_path_in.c_str(), &db);

    if (rc) {
        std::fprintf(stderr, "Can't open database: %s\n", sqlite3_errmsg(db));
        return EXIT_FAILURE;
    } else {
        std::fprintf(stderr, "Opened sqlite3 database successfully\n");
    }

    pqxx::connection conn(postgres_connection);

    if (conn.is_open()) {
        std::cout << "Connected to postgres" << std::endl;
    } else {
        std::cout << "Couldn't connect to postgres" << std::endl;
        return EXIT_FAILURE;
    }

    // Look for all distinct video_timestamp names
    sqlite3_stmt *stmt;
    std::string sql = "SELECT DISTINCT name, start_ts, end_ts FROM video_timestamps;";
    rc = sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr);
    if (rc != SQLITE_OK) {
        std::cerr << "SQL error: " << sqlite3_errmsg(db) << std::endl;
        sqlite3_close(db);
        return EXIT_FAILURE;
    }

    // Execute SQLite query
    while ((rc = sqlite3_step(stmt)) == SQLITE_ROW) {
        const char *video_name = reinterpret_cast<const char *>(sqlite3_column_text(stmt, 0));
        double start_ts = sqlite3_column_double(stmt, 1);
        double end_ts = sqlite3_column_double(stmt, 2);

        // Query keyframes from PostgreSQL within the start-end range
        pqxx::nontransaction ntxn(conn);
        pqxx::result keyframes =
            ntxn.exec("SELECT keyframe_id, ts FROM nodes WHERE ts >= " + std::to_string(start_ts) + " AND ts <= " + std::to_string(end_ts));

        // Process each keyframe
        for (const auto &keyframe : keyframes) {
            double keyframe_ts = keyframe["ts"].as<double>();

            // Calculate how far through the video file the keyframe timestamp is
            double offset = keyframe_ts - start_ts;

            // Open JSON file based on video name
            std::string json_filename = json_dir + "/" + std::string(video_name) + ".json";
            std::ifstream json_file(json_filename);
            if (!json_file.is_open()) {
                std::cerr << "Failed to open JSON file: " << json_filename << std::endl;
                continue;
            }

            // Parse JSON
            nlohmann::json json_data;
            json_file >> json_data;

            // Find the entry in JSON where ts is within
            std::string group_name;
            for (auto it = json_data.begin(); it != json_data.end(); ++it) {
                double ts = std::stod(it.key());
                if (keyframe_ts >= ts) {
                    group_name = it.value();
                } else {
                    break;
                }
            }

            // INSERT into node_location table
            pqxx::work txn(conn);
            txn.exec_params("INSERT INTO node_location (ts, keyframe_id, group_id) VALUES ($1, $2, $3)", keyframe_ts, keyframe["keyframe_id"].as<int>(),
                            group_name);
            txn.commit();
        }
    }

    sqlite3_finalize(stmt);
    sqlite3_close(db);
    return 0;
}
