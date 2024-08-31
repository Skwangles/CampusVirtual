#!/bin/bash

# Depends on the Stella VSLAM and CampusVirtualInterfaces already being built

# Build the CampusVirtual control program - OR 
g++ ./ENTRYPOINT/runCampusVirtual.cc -o runCampusVirtual -lboost_program_options

# Create Map with G block
# ./runCampusVirtual true ./ VID_20240830_134002_00_001.mp4 --out outdoors.db --media_dir /media/skwangles/KINGSTON/MEDIA/Videos --map_dir /home/skwangles/Documents/Honours/MEDIA/Maps/ --json_dir /media/skwangles/KINGSTON/MEDIA/JSON/
./runCampusVirtual true ./ VID_20240830_135610_00_003.mp4 --in outdoors.db --out outdoors-2.db --media_dir /media/skwangles/KINGSTON/MEDIA/Video/ --map_dir /home/skwangles/Documents/Honours/MEDIA/Maps/ --json_dir /media/skwangles/KINGSTON/MEDIA/JSON/
./runCampusVirtual true ./ VID_20240830_140935_00_004.mp4 --in outdoors-2.db --out outdoors-3.db --media_dir /media/skwangles/KINGSTON/MEDIA/Video/ --map_dir /home/skwangles/Documents/Honours/MEDIA/Maps/ --json_dir /media/skwangles/KINGSTON/MEDIA/JSON/

# Send to Postgres
# ./runCampusVirtual true ./ --videos . --in outdoors.db --out . --media_dir /media/skwangles/KINGSTON/MEDIA/ --json_dir /media/skwangles/KINGSTON/MEDIA/JSON/ --convertToPg