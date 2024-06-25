#!/bin/bash


# Depends on the Stella VSLAM and CampusVirtualInterfaces already being built

# Build the CampusVirtual control program
g++ ./runCampusVirtual.cpp -o runCampusVirtual

# Create Map with G block
./runCampusVirtual ./ G-block-smaller.mp4 g.db

# Add S block
./runCampusVirtual ./ S-Block-From-G.mp4 g.db g-s.db

# Add F block & FG
 ./runCampusVirtual ./ FG-F-from-G.mp4 g-s.db g-s-f-fg.db

# Add second F
./runCampusVirtual ./ F-block.mp4 g-s-f-fg.db g-s-f2-fg.db

# Add E block
./runCampusVirtual ./ E-block-fast.mp4 g-s-f2-fg.db g-s-f-fg-e.db
