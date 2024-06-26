#!/bin/bash


# Depends on the Stella VSLAM and CampusVirtualInterfaces already being built

# Build the CampusVirtual control program - OR 
g++ ./runCampusVirtual.cc -o runCampusVirtual -lboost_program_options

# Create Map with G block
./runCampusVirtual false ./ G-block-smaller.mp4 --in g.db --out test.db --convertToGraph

# # Add S block
# ./runCampusVirtual false ./ S-Block-From-G.mp4 --in g.db --out g-s.db

# # Add F block & FG
#  ./runCampusVirtual false ./ FG-F-from-G.mp4 --in g-s.db --out g-s-f-fg.db

# # Add second F
# ./runCampusVirtual false ./ F-block.mp4 --in g-s-f-fg.db --out g-s-f2-fg.db

# # Add E block
# ./runCampusVirtual false ./ E-block-fast.mp4 --in g-s-f2-fg.db --out g-s-f-fg-e.db
