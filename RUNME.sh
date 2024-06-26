#!/bin/bash


# Depends on the Stella VSLAM and CampusVirtualInterfaces already being built

# Build the CampusVirtual control program - OR 
g++ ./runCampusVirtual.cc -o runCampusVirtual -lboost_program_options

# Create Map with G block
./runCampusVirtual false ./ G-block-smaller.mp4 test_out.db

# # Add S block
# ./runCampusVirtual false ./ S-Block-From-G.mp4 g.db g-s.db

# # Add F block & FG
#  ./runCampusVirtual false ./ FG-F-from-G.mp4 g-s.db g-s-f-fg.db

# # Add second F
# ./runCampusVirtual false ./ F-block.mp4 g-s-f-fg.db g-s-f2-fg.db

# # Add E block
# ./runCampusVirtual false ./ E-block-fast.mp4 g-s-f2-fg.db g-s-f-fg-e.db
