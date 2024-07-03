#pragma once

#include "stella_vslam/system.h"
#include "stella_vslam/config.h"
#include "stella_vslam/camera/base.h"
#include "stella_vslam/util/yaml.h"
#include "stella_vslam/util/string.h"

#include <iostream>
#include <chrono>
#include <fstream>
#include <numeric>
#include <string>

#include <opencv2/core/mat.hpp>
#include <opencv2/core/types.hpp>
#include <opencv2/imgcodecs.hpp>
#include <opencv2/videoio.hpp>
#include <spdlog/spdlog.h>
#include <popl.hpp>

#include <sqlite3.h>

#include <ghc/filesystem.hpp>
namespace fs = ghc::filesystem;

#include "video_timestamp.hpp"

std::vector<video_timestamp> load_video_timestamps(sqlite3* db) {
    std::vector<video_timestamp> results;
    sqlite3_stmt* stmt;

    const char* sql = "SELECT name, start_ts, end_ts FROM video_timestamps";

    if (sqlite3_prepare_v2(db, sql, -1, &stmt, 0) == SQLITE_OK) {
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            std::string name = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
            double start_ts = sqlite3_column_double(stmt, 1);
            double end_ts = sqlite3_column_double(stmt, 2);

            results.emplace_back(video_timestamp(name, start_ts, end_ts));
        }
        sqlite3_finalize(stmt);
    } else {
        std::cerr << "Failed to execute query: " << sqlite3_errmsg(db) << std::endl;
    }

    return results;
}


int save_video_to_db(sqlite3 *db, std::string video_name, double start_timestamp, double end_timestamp){
    
    std::vector<std::pair<std::string, std::string>> columns{
        {"name", "BLOB"},
        {"start_ts", "REAL"},
        {"end_ts", "REAL"}};

    int ret = 0;
    if (ret == SQLITE_OK) {
        std::string stmt_str = "CREATE TABLE IF NOT EXISTS video_timestamps(id INTEGER PRIMARY KEY AUTOINCREMENT";
        for (const auto& column : columns) {
            stmt_str += ", " + column.first + " " + column.second;
        }
        stmt_str += ");";
        ret = sqlite3_exec(db, stmt_str.c_str(), nullptr, nullptr, nullptr);
    }

    if (ret != SQLITE_OK) {
        spdlog::error("SQLite error (create_table): {}", sqlite3_errmsg(db));
        return false;
    }

    if (ret == SQLITE_OK) {
        ret = sqlite3_exec(db, "BEGIN;", nullptr, nullptr, nullptr);
    }

    sqlite3_stmt* stmt = nullptr;
    if (ret == SQLITE_OK) {
        std::string stmt_str = "INSERT INTO video_timestamps(";
        bool first = true;
        for (const auto& column : columns) {
            if (first) {
                stmt_str += column.first;
                first = false;
            } else {
                stmt_str += ", " + column.first;
            }
        }
        stmt_str += ") VALUES(";
        first = true;
        for (size_t i = 0; i < columns.size(); ++i) {
            if (first) {
                stmt_str += "?";
                first = false;
            } else {
                stmt_str += ", ?";
            }
        }
        stmt_str += ")";
        ret = sqlite3_prepare_v2(db, stmt_str.c_str(), -1, &stmt, nullptr);
    }
    if (ret != SQLITE_OK) {
        spdlog::error("SQLite error (prepare): {}", sqlite3_errmsg(db));
        return false;
    }

    
    if (ret == SQLITE_OK) {
        ret = sqlite3_bind_blob(stmt, 1, video_name.c_str(), video_name.size(), SQLITE_TRANSIENT);
    }
    if (ret == SQLITE_OK) {
        ret = sqlite3_bind_double(stmt, 2, start_timestamp);
    }
    if (ret == SQLITE_OK) {
        ret = sqlite3_bind_double(stmt, 3, end_timestamp);
    }

    if (ret == SQLITE_OK) {
            ret = sqlite3_step(stmt);
    }
    if (ret != SQLITE_DONE) {
        spdlog::error("SQLite step failed: {}", sqlite3_errmsg(db));
        return false;
    }
    sqlite3_finalize(stmt);
    ret = sqlite3_exec(db, "COMMIT;", nullptr, nullptr, nullptr);
    if (ret != SQLITE_OK) {
        spdlog::error("SQLite error (commit): {}", sqlite3_errmsg(db));
        return false;
    }

    return 0;
}
