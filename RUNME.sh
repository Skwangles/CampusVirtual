#!/bin/bash

# Depends on the Stella VSLAM and CampusVirtualInterfaces already being built

# Build the CampusVirtual control program - OR 
g++ ./runCampusVirtual.cc -o runCampusVirtual -lboost_program_options

# # Short testing media
# ./runCampusVirtual true ./ short-straight.mp4 --out straight.db --media_dir /media/skwangles/KINGSTON/MEDIA/
# # ./runCampusVirtual true ./ short-turn.mp4  --in straight.db --out straight-turn.db --media_dir /media/skwangles/KINGSTON/MEDIA/

# # View it
# ./runCampusVirtual true ./ .  --in straight-turn.db --out . --media_dir /media/skwangles/KINGSTON/MEDIA/ --convertToGraph



# Create Map with G block
# ./runCampusVirtual true ./ G-block-2.mp4,G-block-smaller.mp4 --out g.db --media_dir /media/skwangles/KINGSTON/MEDIA/

# # View it
# # ./runCampusVirtual true ./ .  --in g.db --out . --media_dir /media/skwangles/KINGSTON/MEDIA/ --convertToGraph


# # Add S block
# ./runCampusVirtual true ./ S-Block-From-G.mp4 --in g.db --out g-s.db --media_dir /media/skwangles/KINGSTON/MEDIA/

# # # Add F block & FG
# ./runCampusVirtual true ./ FG-F-from-G.mp4,F-block.mp4 --in g-s.db --out g-s-f-fg.db --media_dir /media/skwangles/KINGSTON/MEDIA/

# # # Add E block
# ./runCampusVirtual true ./ E-block-fast.mp4 --in g-s-f-fg.db --out g-s-f-fg-e.db --media_dir /media/skwangles/KINGSTON/MEDIA/

./runCampusVirtual true ./ . --in g-s-f-fg-e.db --out . --media_dir /media/skwangles/KINGSTON/MEDIA/ --convertToGraph
