#pragma once

#include <string>

class video_timestamp {
public:
    std::string name;
    double start_timestamp;
    double stop_timestamp;

    video_timestamp(std::string name, double start_timestamp, double stop_timestamp)
        : name(name), start_timestamp(start_timestamp), stop_timestamp(stop_timestamp) {}
};