# Stella libs - https://stella-cv.readthedocs.io/en/latest/installation.html
apt update -y
apt upgrade -y --no-install-recommends
# basic dependencies
apt install -y build-essential pkg-config cmake git wget curl unzip
# g2o dependencies
apt install -y libatlas-base-dev libsuitesparse-dev
# OpenCV dependencies
apt install -y libgtk-3-dev ffmpeg libavcodec-dev libavformat-dev libavutil-dev libswscale-dev libavresample-dev libtbb-dev
# eigen dependencies
apt install -y gfortran
# backward-cpp dependencies (optional)
apt install -y binutils-dev
# other dependencies
apt install -y libyaml-cpp-dev libgflags-dev sqlite3 libsqlite3-dev

# (if you plan on using IridescenceViewer)
# Iridescence dependencies
apt install -y libglm-dev libglfw3-dev libpng-dev libjpeg-dev libeigen3-dev libboost-filesystem-dev libboost-program-options-dev

# (if you plan on using PangolinViewer)
# Pangolin dependencies
apt install -y libglew-dev

# (if you plan on using SocketViewer)
# Protobuf dependencies
apt install -y autogen autoconf libtool
# Node.js
# curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash - # OLD VERSION WE DON'T WANT TO USE
sudo apt install -y nodejs
sudo apt install -y npm

# Install Custom FBoW used
cd /tmp
git clone https://github.com/stella-cv/FBoW.git
cd FBoW
mkdir build && cd build
cmake \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=/usr/local \
    ..
make -j4 && sudo make install


# Eigen3 - https://gitlab.com/libeigen/eigen
sudo apt install libeigen3-dev

# OpenCV - https://phoenixnap.com/kb/installing-opencv-on-ubuntu
sudo apt install libopencv-dev

# Install g2o
cd /tmp
git clone https://github.com/RainerKuemmerle/g2o.git
cd g2o
git checkout 20230223_git
mkdir build && cd build
cmake \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=/usr/local \
    -DBUILD_SHARED_LIBS=ON \
    -DBUILD_UNITTESTS=OFF \
    -DG2O_USE_CHOLMOD=OFF \
    -DG2O_USE_CSPARSE=ON \
    -DG2O_USE_OPENGL=OFF \
    -DG2O_USE_OPENMP=OFF \
    -DG2O_BUILD_APPS=OFF \
    -DG2O_BUILD_EXAMPLES=OFF \
    -DG2O_BUILD_LINKED_APPS=OFF \
    ..
make -j4 && sudo make install

# Install backward-cpp - 
cd /tmp
git clone https://github.com/bombela/backward-cpp.git
cd backward-cpp
git checkout 5ffb2c879ebdbea3bdb8477c671e32b1c984beaa
mkdir build && cd build
cmake \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=/usr/local \
    ..
make -j4 && sudo make install


################# VIEWERS #####################
# Install Iridescence-viewer
cd /tmp
git clone https://github.com/koide3/iridescence.git
cd iridescence
git checkout 085322e0c949f75b67d24d361784e85ad7f197ab
git submodule update --init --recursive
mkdir build && cd build
cmake \
    -DCMAKE_BUILD_TYPE=RelWithDebInfo \
    ..
make -j4 && sudo make install


sudo apt install -y libprotobuf-dev protobuf-compiler
cd /tmp
git clone https://github.com/shinsumicco/socket.io-client-cpp.git
cd socket.io-client-cpp
git submodule init
git submodule update
mkdir build && cd build
cmake \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=/usr/local \
    -DBUILD_UNIT_TESTS=OFF \
    ..
make -j4
sudo make install

############### BUILD STELLA VSLAM ###############

# Install stella_vslam core library
mkdir -p ~/lib
cd ~/lib
git clone --recursive https://github.com/stella-cv/stella_vslam.git
cd stella_vslam
mkdir build && cd build
cmake -DCMAKE_BUILD_TYPE=RelWithDebInfo ..
make -j4
sudo make install

# When building with support for IridescenceViewer
cd ~/lib
git clone --recursive https://github.com/stella-cv/iridescence_viewer.git
mkdir -p iridescence_viewer/build
cd iridescence_viewer/build
cmake -DCMAKE_BUILD_TYPE=RelWithDebInfo ..
make -j
sudo make install

# When building with support for SocketViewer
cd ~/lib
git clone --recursive https://github.com/Skwangles/socket_publisher.git # Custom socket_publisher which doesn't send current frame, only the map - forked from https://github.com/stella-cv/socket_publisher.git
mkdir -p socket_publisher/build
cd socket_publisher/build
cmake -DCMAKE_BUILD_TYPE=RelWithDebInfo ..
make -j
sudo make install



########## CAMPUS VIRTUAL SPECIFIC CODE ##########
cd /media/skwangles/KINGSTON/CampusVirtual/


# Install custom socket_viewer which acts like Google Street View - forked from https://github.com/stella-cv/socket_viewer.git
git clone --recursive https://github.com/Skwangles/CampusVirtual-SocketViewer.git && cd CampusVirtual-SocketViewer && sudo npm install --no-bin-links 
# Make sure to run this in a separate terminal before running the CampusVirtualInterface with `node app.js`

# Installs MediaSDKTest tool for stitching videos
sudo dpkg -i /media/skwangles/KINGSTON/CampusVirtual/FileProcessing/libMediaSDK-dev_2.0-3_amd64_ubuntu18.04.deb

# Build ProcessFiles
cd /media/skwangles/KINGSTON/CampusVirtual/FileProcessing/ && g++ ./ProcessFiles.cpp -o ./ProcessFiles && cd ..

mkdir -p /media/skwangles/KINGSTON/CampusVirtual/SLAM/CampusVirtualInterface/build
cd /media/skwangles/KINGSTON/CampusVirtual/SLAM/CampusVirtualInterface/build && cmake -DCMAKE_BUILD_TYPE=RelWithDebInfo -DUSE_STACK_TRACE_LOGGER=ON .. && make -j4

# Build controller program
cd /media/skwangles/KINGSTON/CampusVirtual/ && g++ ./runCampusVirtual.cc -o runCampusVirtual -lboost_program_options

echo "Run 'node app.js' in /media/skwangles/KINGSTON/CampusVirtual/socket_viewer to start the socket viewer - before running the CampusVirtualInterface. Make sure the SLAM/equirectangular.yaml file has the right SocketViewer IP address."

