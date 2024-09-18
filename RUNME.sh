#!/bin/bash

# Depends on the Stella VSLAM and CampusVirtualInterfaces already being built

# Build the CampusVirtual control program - OR 
g++ ./ENTRYPOINT/runCampusVirtual.cc -o runCampusVirtual -lboost_program_options

# Create Map with Raw video
# sudo ./runCampusVirtual false ./ S-Block-From-G.mp4 --in g-full.db --out otherbuildings.db --media_dir /media/skwangles/KINGSTON/MEDIA/TestVideo/ --map_dir /home/skwangles/Documents/Honours/MEDIA/Maps/ --json_dir /media/skwangles/KINGSTON/MEDIA/JSON/ --picture-dir /media/skwangles/KINGSTON/MEDIA/pictures
# ./runCampusVirtual false ./ FG-F-from-G.mp4,F-block.mp4,E-block-fast.mp4 --in otherbuildings.db --out otherbuildings.db --media_dir /media/skwangles/KINGSTON/MEDIA/TestVideo/ --map_dir /home/skwangles/Documents/Honours/MEDIA/Maps/ --json_dir /media/skwangles/KINGSTON/MEDIA/JSON/ --picture-dir /media/skwangles/KINGSTON/MEDIA/pictures
# ./runCampusVirtual true ./ VID_20240830_134002_00_001.mp4  --in otherbuildings.db --out outdoors.db --media_dir /media/skwangles/KINGSTON/MEDIA/Video/ --map_dir /home/skwangles/Documents/Honours/MEDIA/Maps/ --json_dir /media/skwangles/KINGSTON/MEDIA/JSON/ --picture-dir /media/skwangles/KINGSTON/MEDIA/pictures
# ./runCampusVirtual true ./ VID_20240830_135610_00_003.mp4 --in outdoors.db --out outdoors-2.db --media_dir /media/skwangles/KINGSTON/MEDIA/Video/ --map_dir /home/skwangles/Documents/Honours/MEDIA/Maps/ --json_dir /media/skwangles/KINGSTON/MEDIA/JSON/ --picture-dir /media/skwangles/KINGSTON/MEDIA/pictures
# ./runCampusVirtual true ./ VID_20240830_140935_00_004.mp4 --in outdoors-2.db --out outdoors-3.db --media_dir /media/skwangles/KINGSTON/MEDIA/Video/ --map_dir /home/skwangles/Documents/Honours/MEDIA/Maps/ --json_dir /media/skwangles/KINGSTON/MEDIA/JSON/ --picture-dir /media/skwangles/KINGSTON/MEDIA/pictures

# # Send to Postgres
./runCampusVirtual false ./ --videos . --in otherbuildings.db --out . --media_dir . --map_dir /home/skwangles/Documents/Honours/MEDIA/Maps/ --json_dir /media/skwangles/KINGSTON/MEDIA/JSON/ --convertToPg

cd ./Postgres/GraphPruner

npm run start
