#include <iostream>
#include <string>
#include <boost/program_options.hpp>

std::string path_to_stella = "SLAM/CampusVirtualInterface/build/";
std::string path_to_fbow = "SLAM/FBoW/orb_vocab.fbow";
std::string path_to_config = "SLAM/equirectangular.yaml";

namespace po = boost::program_options;

int main(int argc, char** argv) {
    po::options_description desc("Allowed options");
    desc.add_options()
        ("help,h", "produce help message")
        ("headless", po::value<bool>()->default_value(false), "Use headless (true|false)")
        ("project_dir", po::value<std::string>()->required(), "Campus virtual project directory")
        ("media_dir", po::value<std::string>()->required(), "Media directory - videos and maps")
        ("videos", po::value<std::string>()->required(), "Comma-separated ordered videos")
        ("in", po::value<std::string>(), "Input map (*.db)")
        ("out", po::value<std::string>()->required(), "Output map (*.db)")
        ("convertToGraph", "Convert to graph (optional)")
        ("convertToPg", "Convert to Postgres (optional)");

    po::positional_options_description pos_desc;
    pos_desc.add("headless", 1);
    pos_desc.add("project_dir", 1);
    pos_desc.add("videos", 1);

    po::variables_map vm;
    try {
        po::store(po::command_line_parser(argc, argv).options(desc).positional(pos_desc).run(), vm);
        po::notify(vm);

        if (vm.count("help")) {
            std::cout << desc << std::endl;
            return 1;
        }

        // Check for required arguments
        if (!vm.count("project_dir") || !vm.count("videos") || !vm.count("out")) {
            std::cout << "Missing required arguments!" << std::endl;
            std::cout << desc << std::endl;
            return 1;
        }

        bool use_headless = vm["headless"].as<bool>();
        std::string project_dir = vm["project_dir"].as<std::string>();
        std::string videos = vm["videos"].as<std::string>();
        std::string map_in = vm.count("in") ? vm["in"].as<std::string>() : "";
        std::string map_out = vm["out"].as<std::string>();
        std::string media_dir = vm["media_dir"].as<std::string>();
        bool convert_to_graph = vm.count("convertToGraph");
        bool convert_to_graph = vm.count("convertToPg");



        std::string command;
        if (convert_to_pg){
            command = "pgloader " + media_dir + "/Maps/" + map_in + 
                " postgresql://test:test@localhost:5432/campusvirtual"; // Based on docker-compose.yml default config
        }
        else if (convert_to_graph){
            command = project_dir + path_to_stella + "campus_virtual_viewer" +
                              " -c " + project_dir + path_to_config +
                              " -v " + project_dir + path_to_fbow +
                              (map_in.empty() ? "" : " --map-db-in " + media_dir + "/Maps/" + map_in) +
                              " --map-db-out " +  media_dir + "/Maps/" + map_out;
        }
        else {
            command = project_dir + path_to_stella + "campus_virtual" +
                                        " -c " + project_dir + path_to_config +
                                        " -v " + project_dir + path_to_fbow +
                                        (map_in.empty() ? "" : " --map-db-in " + media_dir + "/Maps/" + map_in) +
                                        " --map-db-out " +  media_dir + "/Maps/" + map_out +
                                        " --videos " + videos +
                                        " --no-sleep " + 
                                        " --video-dir " +  media_dir + "/Video/ " +
                                       (use_headless ? "--viewer none" : " --viewer iridescence_viewer");
        }
        
        std::cout << "Command: " << command << std::endl;
        system(command.c_str());

    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}
