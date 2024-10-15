#!/bin/bash

# Depends on the Stella VSLAM and CampusVirtualInterfaces already being built

# Build the CampusVirtual control program - OR 
g++ ./ENTRYPOINT/runCampusVirtual.cc -o runCampusVirtual -lboost_program_options

# ./runCampusVirtual false ./ VID_20241012_115918_00_042.mp4 --out eds.db --media_dir /media/skwangles/KINGSTON/MEDIA/EDS --map_dir /home/skwangles/Documents/Honours/MEDIA/Maps/ --json_dir /media/skwangles/KINGSTON/MEDIA/JSON/ --picture-dir /media/skwangles/KINGSTON/MEDIA/eds-pictures
# ./runCampusVirtual false ./ VID_20241014_164244_00_048.mp4 --in eds.db --out eds-1.db --media_dir /media/skwangles/KINGSTON/MEDIA/EDS --map_dir /home/skwangles/Documents/Honours/MEDIA/Maps/ --json_dir /media/skwangles/KINGSTON/MEDIA/JSON/ --picture-dir /media/skwangles/KINGSTON/MEDIA/eds-pictures
# ./runCampusVirtual false ./ VID_20241014_153254_00_045.mp4 --in eds-1.db --out eds-2nd.db --media_dir /media/skwangles/KINGSTON/MEDIA/EDS --map_dir /home/skwangles/Documents/Honours/MEDIA/Maps/ --json_dir /media/skwangles/KINGSTON/MEDIA/JSON/ --picture-dir /media/skwangles/KINGSTON/MEDIA/eds-pictures
# ./runCampusVirtual false ./ VID_20241014_155320_00_046.mp4 --in eds-2nd.db --out eds-3.db --media_dir /media/skwangles/KINGSTON/MEDIA/EDS --map_dir /home/skwangles/Documents/Honours/MEDIA/Maps/ --json_dir /media/skwangles/KINGSTON/MEDIA/JSON/ --picture-dir /media/skwangles/KINGSTON/MEDIA/eds-pictures


# Library
# ./runCampusVirtual false ./ VID_20241014_161316_00_047.mp4 --out eds.db --media_dir /media/skwangles/KINGSTON/MEDIA/EDS --map_dir /home/skwangles/Documents/Honours/MEDIA/Maps/ --json_dir /media/skwangles/KINGSTON/MEDIA/JSON/ --picture-dir /media/skwangles/KINGSTON/MEDIA/eds-pictures

# Edit it/manually loop closure
# ./runCampusVirtual false ./ --videos . --in eds-3-backup.db --out eds-edited.db --media_dir . --map_dir /home/skwangles/Documents/Honours/MEDIA/Maps/ --json_dir /media/skwangles/KINGSTON/MEDIA/JSON/ --convertToGraph
# ./runCampusVirtual false ./ --videos . --in eds-edited.db --out eds-edited.db --media_dir . --map_dir /home/skwangles/Documents/Honours/MEDIA/Maps/ --json_dir /media/skwangles/KINGSTON/MEDIA/JSON/ --convertToGraph

# # Send to Postgres
./runCampusVirtual false ./ --videos . --in eds-3.db --out . --media_dir . --map_dir /home/skwangles/Documents/Honours/MEDIA/Maps/ --json_dir /media/skwangles/KINGSTON/MEDIA/JSON/ --convertToPg

# cd ./Apps/GraphPruner

# npm run start
