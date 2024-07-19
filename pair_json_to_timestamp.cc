#include "sqlite3.h"
#include <iostream>
#include <pqxx/pqxx> 
#include <popl.hpp>
#include <stdio.h>
#include <fstream>
#include <nlohmann/json.hpp> // JSON library, e.g., nlohmann/json.hpp


void create_tables_if_not_exist(pqxx::connection& conn) {
    pqxx::work txn(conn);

    txn.exec(R"(
        CREATE TABLE IF NOT EXISTS node_location (
            id SERIAL PRIMARY KEY,
            ts NUMERIC NOT NULL,
            keyframe_id INTEGER UNIQUE NOT NULL,
            group_id VARCHAR(256)
        );
    )");
    txn.exec("TRUNCATE TABLE node_location RESTART IDENTITY;"); // Corrected to 'RESTART IDENTITY'
        
    // Commit the transaction
    txn.commit();
}

int main(int argc, char* argv[]) {
    // create options
    popl::OptionParser op("Allowed options");
    auto help = op.add<popl::Switch>("h", "help", "produce help message");
    auto map_db_path_in = op.add<popl::Value<std::string>>()->required("i", "map-db-in", "load a map from this path", ""); // Corrected syntax
    auto json_dir = op.add<popl::Value<std::string>>()->required("j", "json_dir", "json_dir", ""); // Corrected syntax
    auto postgres_connection = op.add<popl::Value<std::string>>()->required("d", "db", "postgres connection string", "postgresql://test:test@localhost:5432/campusvirtual"); // Corrected syntax
   
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

    sqlite3 *db;
    int rc; 

    rc = sqlite3_open(map_db_path_in->value().c_str(), &db); // Corrected usage of map_db_path_in

    if (rc) {
        std::fprintf(stderr, "Can't open database: %s\n", sqlite3_errmsg(db));
        return EXIT_FAILURE;
    } else {
        std::fprintf(stderr, "Opened sqlite3 database successfully\n");
    }

    pqxx::connection conn(postgres_connection->value()); // Corrected usage of postgres_connection

    if (conn.is_open()) {
        std::cout << "Connected to postgres" << std::endl;
    } else {
        std::cout << "Couldn't connect to postgres" << std::endl;
        return EXIT_FAILURE;
    }

    // Look for all keyframes to look up from the postgres
    pqxx::nontransaction ntxn(conn);

    pqxx::result res(ntxn.exec("SELECT keyframe_id, ts FROM nodes;"));

    for (pqxx::result::const_iterator c = res.begin(); c != res.end(); ++c) {
        std::string sql = "SELECT name, start_ts FROM video_timestamps WHERE start_ts <= " + std::to_string(c[1].as<double>()) + " AND end_ts >= " + std::to_string(c[1].as<double>()) + ";";

        // Execute SQLite query
        sqlite3_stmt *stmt;
        rc = sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr);
        if (rc != SQLITE_OK) {
            std::cerr << "SQL error: " << sqlite3_errmsg(db) << std::endl;
            sqlite3_finalize(stmt);
            continue;
        }

        // Fetch results
        rc = sqlite3_step(stmt);
        if (rc == SQLITE_ROW) {
            const char *video_name = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
            double start_ts = sqlite3_column_double(stmt, 1);

            // Calculate how far through the video file the c[1] timestamp is
            double offset = c[1].as<double>() - start_ts;

            // Open JSON file based on video name
            std::string json_filename = json_dir->value() + "/" + std::string(video_name) + ".json";
            std::ifstream json_file(json_filename);
            if (!json_file.is_open()) {
                std::cerr << "Failed to open JSON file: " << json_filename << std::endl;
                sqlite3_finalize(stmt);
                continue;
            }

            // Parse JSON
            nlohmann::json json_data;
            json_file >> json_data;

            // Find the entry in JSON where ts is within
            std::string group_name;
            for (auto it = json_data.begin(); it != json_data.end(); ++it) {
                double ts = std::stod(it.key());
                if (c[1].as<double>() >= ts) {
                    group_name = it.value();
                } else {
                    break;
                }
            }

            // INSERT into node_location table
            pqxx::work txn(conn);
            txn.exec_params("INSERT INTO node_location (ts, keyframe_id, group_id) VALUES ($1, $2, $3)",
                c[1].as<double>(), c[0].as<int>(), group_name);
            txn.commit();
        }

        sqlite3_finalize(stmt);
    }

    // Close the database connection
    sqlite3_close(db);

    conn.disconnect();
    return 0;
}
