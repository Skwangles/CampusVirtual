#include <string>
#include <iostream>

std::string campus_virtual_dir = "/media/skwangles/KINGSTON/";
std::string path_to_stella = campus_virtual_dir + "CampusVirtual/SLAM/Stella/CampusVirtualInterface/build/run_campus_virtual";
std::string path_to_fbow = campus_virtual_dir + "CampusVirtual/SLAM/FBoW/orb_vocab.fbow";
std::string path_to_config = campus_virtual_dir + "CampusVirtual/SLAM/equirectangular.yaml";
std::string path_to_maps = campus_virtual_dir + "CampusVirtual/Maps/";
std::string path_to_videos = campus_virtual_dir + "MEDIA/Video/";

int main(int argc, char **argv) {

    if (argc != 4 && argc != 5){
        std::cout << "Usage: ./runCampusVirtual <campus_virtual_project_dir>  <comma_separated_ordered_videos> <(optional) map_in> <map_out>  \n"
                    << " e.g. ./runCampusVirtual /home/admin/CampusVirtual/ vid1.mp4,vid2.mp4,vid3.mp4 example.db input.db" << std::endl;
        return 1;
    }

    std::string campus_virtual_dir = argv[1];
    std::string videos = argv[2];
    std::string map_out = argc == 4 ? argv[3] : argv[4];

    std::string command = path_to_stella + 
                " -c " + path_to_config + 
                " -v " + path_to_fbow + 
                " --no-sleep " + 
                (argc !=  5 ? "" : " --map-db-in " + path_to_maps + argv[3]) + 
                " --map-db-out " + campus_virtual_dir + map_out + 
                // "-t 0" + // Do not set timestamp, as internally the timestamp is set to the current time and used to distinguish which keyframes are from what video
                "--videos " + videos + 
                " --video-dir " + campus_virtual_dir + "Video/"
                " --auto-term";

    system(command.c_str());
    return 0;
}

