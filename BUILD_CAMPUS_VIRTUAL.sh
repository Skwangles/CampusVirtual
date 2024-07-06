########## CAMPUS VIRTUAL SPECIFIC CODE ##########
echo "MUST BE RUN IN root CampusVirtual/"

# Install custom socket_viewer which acts like Google Street View - forked from https://github.com/stella-cv/socket_viewer.git
cd CampusVirtual-SocketViewer && sudo npm install && cd ..
# Make sure to run this in a separate terminal before running the CampusVirtualInterface with `node app.js`

# Installs MediaSDKTest tool for stitching videos
sudo dpkg -i CampusVirtual-FileProcessing/libMediaSDK-dev_2.0-3_amd64_ubuntu18.04.deb

# Build ProcessFiles
cd CampusVirtual-FileProcessing/ && g++ ./ProcessFiles.cpp -o ./ProcessFiles && cd ..

mkdir -p SLAM/CampusVirtualInterface/build
cd SLAM/CampusVirtualInterface/build && cmake -DCMAKE_BUILD_TYPE=RelWithDebInfo -DUSE_STACK_TRACE_LOGGER=ON .. && make -j4 && cd ../../../

# Build controller program
g++ ./runCampusVirtual.cc -o runCampusVirtual -lboost_program_options


echo "Run 'node app.js' in CampusVirtual_socket_viewer to start the socket viewer - before running the CampusVirtualInterface. Make sure the SLAM/equirectangular.yaml file has the right SocketViewer IP address."

