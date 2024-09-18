########## CAMPUS VIRTUAL SPECIFIC CODE ##########
echo "DO NOT RUN WITH SUDO - MUST BE RUN IN parent CampusVirtual/"

# Install custom socket_viewer which acts like Google Street View - forked from https://github.com/stella-cv/socket_viewer.git
# cd PgSocketViewer && sudo npm install && cd ..
# Make sure to run this in a separate terminal before running the CampusVirtualInterface with `node app.js`

cd Apps
pwd

# Installs MediaSDKTest tool for stitching videos
sudo dpkg -i CampusVirtual-FileProcessing/libMediaSDK-dev_2.0-3_amd64_ubuntu18.04.deb

cd PgSocketViewer && sudo npm install && cd ..

sudo ldconfig # update lookup library paths again - IMPORTANT if 'libxx.so' not found, note: libxx.so.7 <- 7 is the version number of the package

# IF G2O gives a QT error - sudo apt install -y qtcreator qtbase5-dev qt5-qmake cmake

# Build ProcessFiles
cd CampusVirtual-FileProcessing/ && g++ ProcessFiles.cpp -o ProcessFiles && cd ..
pwd


mkdir -p SLAM/CampusVirtualInterface/build
cd SLAM/CampusVirtualInterface/build 
cmake -DCMAKE_BUILD_TYPE=RelWithDebInfo -DUSE_STACK_TRACE_LOGGER=ON ..
make -j4

cd ../../..

pwd

cd .. # Back to parent dir

# Build controller program
g++ ENTRYPOINT/runCampusVirtual.cc -o runCampusVirtual -lboost_program_options

g++ ENTRYPOINT/pair_json_to_timestamp.cc -o runProcessJsonFiles -lpqxx -lsqlite3 -lboost_program_options


echo "Run 'node app.js' in CampusVirtual_socket_viewer to start the socket viewer - before running the CampusVirtualInterface."

