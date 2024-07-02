Copyright Prof. David Bainbridge (The University of Waikato) 2024 associated with Alexander Stokes honours project CampusVirtual 2024.

# CampusVirtual

To use

- Run `BUILD_CAMPUS_VIRTUAL.sh` to setup Stella VSLAM, FileProcessing, and all the required libs
- Convert your `.insv` and `.insp` files with the FileProcessing tool to mp4s and images
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
