#pragma once

#include <string>

#include <yaml-cpp/yaml.h>


inline YAML::Node yaml_optional_ref(const YAML::Node& ref_node, const std::string& key) {
    return ref_node[key] ? ref_node[key] : YAML::Node();
}


