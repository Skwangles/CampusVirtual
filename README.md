# CampusVirtual

To use

- Run `BUILD_CAMPUS_VIRTUAL.sh` to setup Stella VSLAM, FileProcessing, and all the required libs
- Convert your files with the FileProcessing tool to mp4s and images
- Modify RUNME.sh to run the controller on the videos you want, or just manually run the `g++ ./runCampusVirtual.cc -o runCampusVirtual -lboost_program_options` to build and then use.
