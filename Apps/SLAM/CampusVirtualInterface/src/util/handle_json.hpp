#pragma once

#include <nlohmann/json.hpp>
#include <stdio.h>

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

        std::string time_str = timecode["t"].dump();
        time_str.erase(std::remove(time_str.begin(), time_str.end(), '\"'), time_str.end());
        
        double time = std::stod(time_str);
        if (time > seconds){
            return group;
        }
        group = timecode["g"].dump();
        group.erase(std::remove(group.begin(), group.end(), '\"'), group.end());
    }

    return group;
}