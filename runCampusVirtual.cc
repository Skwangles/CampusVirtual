#include <string>
#include <iostream>
#include <string.h>

std::string campus_virtual_dir = "/media/skwangles/KINGSTON/";
std::string path_to_stella = campus_virtual_dir + "/CampusVirtual/SLAM/CampusVirtualInterface/build/";
std::string path_to_fbow = campus_virtual_dir + "/CampusVirtual/SLAM/FBoW/orb_vocab.fbow";
std::string path_to_config = campus_virtual_dir + "/CampusVirtual/SLAM/equirectangular.yaml";
std::string path_to_maps = campus_virtual_dir + "/MEDIA/Maps/";
std::string path_to_videos = campus_virtual_dir + "/MEDIA/Video/";

int main(int argc, char **argv) {

    if (argc != 4 && argc != 5){
        std::cout << "Usage: ./runCampusVirtual <use_headless (true|false)> <campus_virtual_project_dir>  <comma_separated_ordered_videos> <(optional) map_in (*.db)> <map_out (*.db)>  \n"
                    << " e.g. ./runCampusVirtual /home/admin/CampusVirtual/ vid1.mp4,vid2.mp4,vid3.mp4 example.db input.db \n" 
                    << "Everything is relatively ot the project_dir - Maps are taken from the <project_dir>/CampusVirtual/Maps, Videos from <project_dir>/../MEDIA/Video/" << std::endl;
        return 1;
    }

    std::string use_headless = argv[1];
    std::string campus_virtual_dir = argv[2];
    std::string videos = argv[3];
    std::string map_out = argc == 5 ? argv[4] : argv[5];

    std::string command = path_to_stella + ( strcmp(use_headless.c_str(), "true") == 0 ? "headless_campus_virtual" : "campus_virtual") + 
                " -c " + path_to_config + 
                " -v " + path_to_fbow + 
                // " --no-sleep " +  // DO SLEEP! Do it in realtime, so that timestamps accurately reflect the time a frame occurs in the video
                (argc !=  6 ? "" : " --map-db-in " + path_to_maps + argv[4]) + 
                " --map-db-out " + campus_virtual_dir + map_out + 
                // "-t 0" + // Do not set timestamp, as internally the timestamp is set to the current time and used to distinguish which keyframes are from what video
                " --videos " + videos + 
                " --video-dir " + path_to_videos +
                " --viewer iridescence_viewer";
    std::cout << command << std::endl;
    system(command.c_str());
    return 0;
}

