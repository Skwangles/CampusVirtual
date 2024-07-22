#!/bin/bash

# Depends on the Stella VSLAM and CampusVirtualInterfaces already being built

# Build the CampusVirtual control program - OR 
g++ ./ENTRYPOINT/runCampusVirtual.cc -o runCampusVirtual -lboost_program_options

# # Short testing media
# ./runCampusVirtual true ./ short-straight.mp4 --out straight.db --media_dir /media/skwangles/KINGSTON/MEDIA/
# ./runCampusVirtual false ./ short-turn.mp4 --out straight-turn.db --media_dir /media/skwangles/KINGSTON/MEDIA/

# # View it
# ./runCampusVirtual true ./ .  --in straight-turn.db --out . --media_dir /media/skwangles/KINGSTON/MEDIA/ --convertToGraph



# Create Map with G block
# ./runCampusVirtual true ./ G-block-2.mp4 --out test-json.db --media_dir /media/skwangles/KINGSTON/MEDIA/ --json_dir /media/skwangles/KINGSTON/MEDIA/JSON/
# ./runCampusVirtual true ./ G-block-smaller.mp4 --in g-block-test.db --out g.db --media_dir /media/skwangles/KINGSTON/MEDIA/


# # View it
./runCampusVirtual true ./ --videos . --in test-json.db --out . --media_dir /media/skwangles/KINGSTON/MEDIA/ --json_dir . --convertToPg


# # Add S block
# ./runCampusVirtual true ./ S-Block-From-G.mp4 --in g.db --out g-s.db --media_dir /media/skwangles/KINGSTON/MEDIA/

# # # Add F block & FG
# ./runCampusVirtual true ./ FG-F-from-G.mp4,F-block.mp4 --in g-s.db --out g-s-f-fg.db --media_dir /media/skwangles/KINGSTON/MEDIA/

# # # Add E block
# ./runCampusVirtual true ./ E-block-fast.mp4 --in g-s-f-fg.db --out g-s-f-fg-e.db --media_dir /media/skwangles/KINGSTON/MEDIA/

# ./runCampusVirtual true ./ . --in g-s-f-fg-e.db --out . --media_dir /media/skwangles/KINGSTON/MEDIA/ --convertToGraph
