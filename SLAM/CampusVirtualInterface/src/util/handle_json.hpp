#pragma once

#include <nlohmann/json.hpp>

nlohmann::json filename_to_json_obj(std::string json_filename, std::string json_dir){
    nlohmann::json json_obj;
    std::string full_filepath = json_dir + "/" + json_filename;


    std::ifstream json_file(full_filepath.c_str());
    if (!json_file.good()){
        return NULL;
    }
    
    json_file >> json_obj;

    return json_obj;
}

std::string find_group_from_json(nlohmann::json &obj, double &ms){
    if (ms < 0){
        return "";
    }

    double seconds = ms/1000;

    nlohmann::json timecode_array = obj["data"];
    std::string group;
    for (auto timecode : timecode_array){
        double time = std::stod(timecode["t"].dump());
        if (time > seconds){
            return group;
        }
        group = timecode["g"].dump();
    }

    return group;
}