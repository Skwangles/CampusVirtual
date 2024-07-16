Copyright Prof. David Bainbridge (The University of Waikato) 2024 associated with Alexander Stokes honours project CampusVirtual 2024.

# CampusVirtual

## Installing

Clone `git clone --recursive https://github.com/Skwangles/CampusVirtual.git`
Super important that you do it _recursive_, as we have submodules that need cloned for this project to build.

## Required Libs

- Docker - [https://www.docker.com/get-started/](https://www.docker.com/get-started/) - Used for Postgres Database

### Installed by BUILD_LIBS.sh

- OpenCV
- Stella VSLAM
- g2o
- Stella VSlam custom FBoW implementation
- Iridescence
- Node JS

## To use

- Run `BUILD_LIBS.sh` to install Stella VSLAM, OpenCV and all the required libs
- Run `BUILD_CAMPUS_VIRTUAL.sh` to setup the Campus Virtual Interfaces for Stella VSLAM
- Convert your `.insv` and `.insp` files with the FileProcessing tool to mp4s and images
- (If using the GSV style interface) Make sure Docker is installed, and open the CampusVirtual-SocketViewer in a separate terminal and run `node app.js`
- Modify `RUNME.sh` to run the controller on the videos you want, or just manually run the `g++ ./runCampusVirtual.cc -o runCampusVirtual -lboost_program_options` to build and then use as desired.

# Modules

FileProcessing

- Interface on top of Insta360's Linux SDK for image/video stitching

SLAM

- Uses Stella VSLAM
- Feeds in video frames into Stella to build a Sqlite3 map

RunCampusVirtual

- User friendly interface to use Stella
  - Has a headless and live mapping viewer option (see the map as it is built)
  - Allows you to pass in multiple videos in an order based on a parent directory

```
  Allowed options:
  -h [ --help ]         produce help message
  --headless arg (=0)   Use headless (true|false)
  --project_dir arg     Campus virtual project directory
  --videos arg          Comma-separated ordered videos
  --in arg              Input map (*.db)
  --out arg             Output map (*.db)
  --convertToGraph      (Optional) Turns on CampusVirtual viewing mode, operates with socket viewer and displays CampusVirtual at localhost:3001
```
