#include <iostream>
#include <sqlite3.h>

int main(int argc, char* argv[]) {
    // Ensure a database path is provided
    if (argc != 2) {
        std::cerr << "Usage: " << argv[0] << " <database_path>" << std::endl;
        return 1;
    }

    const char* dbPath = argv[1];
    sqlite3* db;
    int exit = 0;

    // Open the database
    exit = sqlite3_open(dbPath, &db);

    if (exit) {
        std::cerr << "Error open DB " << sqlite3_errmsg(db) << std::endl;
        return exit;
    } else {
        std::cout << "Opened Database Successfully!" << std::endl;
    }


    load_keyframes_from_db




    // Close the database connection
    sqlite3_close(db);

    return 0;
}

bool load_keyframes_from_db(sqlite3* db, const std::string& table_name
) {
    sqlite3_stmt* stmt = "SELECT * FROM " + table_name + ";";
    if (!stmt) {
        return false;
    }

    int ret = SQLITE_ERROR;
    while ((ret = sqlite3_step(stmt)) == SQLITE_ROW) {
        auto keyfrm = data::keyframe::from_stmt(stmt, cam_db, orb_params_db, bow_vocab, next_keyframe_id_);
        // Append to map database
        assert(!keyframes_.count(keyfrm->id_));
        keyframes_[keyfrm->id_] = keyfrm;
    }

    sqlite3_finalize(stmt);
    return ret == SQLITE_DONE;
}


std::shared_ptr<keyframe> keyframe::from_stmt(sqlite3_stmt* stmt,
                                              camera_database* cam_db,
                                              orb_params_database* orb_params_db,
                                              unsigned int next_keyframe_id) {
    const char* p;
    int column_id = 0;
    auto id = sqlite3_column_int64(stmt, column_id);
    column_id++;
    // NOTE: src_frm_id is removed
    column_id++;
    auto timestamp = sqlite3_column_double(stmt, column_id);
    column_id++;
    p = reinterpret_cast<const char*>(sqlite3_column_blob(stmt, column_id));
    std::string camera_name(p, p + sqlite3_column_bytes(stmt, column_id));
    const auto camera = cam_db->get_camera(camera_name);
    assert(camera != nullptr);
    column_id++;
    p = reinterpret_cast<const char*>(sqlite3_column_blob(stmt, column_id));
    std::string orb_params_name(p, p + sqlite3_column_bytes(stmt, column_id));
    const auto orb_params = orb_params_db->get_orb_params(orb_params_name);
    assert(orb_params != nullptr);
    
    column_id++;
    Mat44_t pose_cw;
    p = reinterpret_cast<const char*>(sqlite3_column_blob(stmt, column_id));
    std::memcpy(pose_cw.data(), p, sqlite3_column_bytes(stmt, column_id));
  

    auto keyfrm = data::keyframe::make_keyframe(
        id + next_keyframe_id, timestamp, pose_cw, camera, orb_params,
        frm_obs, bow_vec, bow_feat_vec);
    return keyfrm;
}
