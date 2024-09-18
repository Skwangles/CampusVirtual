![CampusVirtual](logo/campusvirtual.png)

## Installing

Clone `git clone --recursive https://github.com/Skwangles/CampusVirtual.git`
Super important that you do it _recursive_, as we have submodules that need cloned for this project to build

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
- Run `docker-compose -f Config/docker-compose.yaml up` to configure the DB
- Convert your `.insv` and `.insp` files and associated JSON files (they are just copied across, so you can do that manually) with the FileProcessing tool to mp4s and images (use `run.sh`)
- Run the Apps/GraphPruner with `npm run start`, this is **REQUIRED** before running the authoring interface and campusvirtual-backend parts
- To view the raw full graph and open the Apps/PgSocketViewer in a separate terminal and run `node app.js`
- To use the Authoring interface, in campusvirtual-backend consts.ts and set ENABLE_AUTHORING_PAGE to 'true', then 'npm run build' in the Apps/authoring directory.
- To view the polished interface, open Apps/campusvirtual-backend and run `npm run start` and visit `localhost:3001` (and `localhost:3001/authoring` for the author page)
- Modify `RUNME.sh` to run the controller on the videos you want, or just manually run the `g++ ./runCampusVirtual.cc -o runCampusVirtual -lboost_program_options` to build and then use as desired.

e.g. `./runCampusVirtual <view SLAM headless/without a viewer (true|false)> ./ <video1.mp4,video2.mp4,video3.mp4> --out <test.db> --media_dir <absolute path to dir of Video/ e.g. /campusvirtua/Video> --map_dir <abs path of Map/> --json_dir <absolute path to JSON/ e.g. /campusvirtual/JSON/> --picture-dir <abs path to save 360 keyframe images to>`

# Modules

### CampusVirtual-FileProcessing - Insta360 SDK and image processor

- Interface on top of Insta360's Linux SDK for image/video stitching

### SLAM - Stella VSLAM modifications

- Uses Stella VSLAM
- Feeds in video frames into Stella to build a Sqlite3 map
- Feeds in JSON files the same name as the video input, which has the timecodes of what location the video was in at what time.
- Saves keyframes to an output directory (these are read in for the web interface, and can be a very large directory, so choose carefully)

### RunCampusVirtual - C++ Interface

- User friendly interface to use Stella
  - Has a headless and live mapping viewer option (see the map as it is built using iridescence as a map viewer)
  - Allows you to pass in multiple videos in an order based on a parent directory
  - Pairs JSON location files to keyframes based on timestamps
  - Allows converting SLAM to postgres database for viewing

### campusvirutal-backend and ui/

- React frontend using THREE.js to visualise the graph, pathfind, and navigate the info present in the PostgreSQL DB
  On first run, it loads all points from refined_nodes, refined_edges, and refined_node_locations into a db for map editing by the authoring page.
  so you MUST RUN THE GRAPH PRUNER FIRST!

## graph-pruner

Pruner for the node, edges, and node_locations tables in PostgreSQL DB, before writing out to refined_X versions of the aforementioned tables.
This pruner uses its consts.ts to prune the underlying model, and output them in a format ready for campusvirtual-backend to serve.
It uses DFS to traverse the graph and prune the paths.

# runCampusVirtual CLI

```
Allowed options:
  -h [ --help ]                  produce help message (though must have all others to get this to run, an oddity I haven't bothered to fix)
  --headless arg (=0)            Use headless (true|false)
  --project_dir arg              Campus virtual project directory
  --media_dir arg                Media directory - videos
  --map_dir arg                  Map directory - maps
  --videos arg                   Comma-separated ordered videos
  --in arg                       Input map (*.db)
  --out arg                      Output map (*.db)
  --json_dir arg                 JSON group-to-timestamp file directory
  --convertToGraph               Convert to graph (optional)
  --convertToPg                  Convert to Postgres (optional)
  --picture-dir arg (=pictures/) Keyframe image output dir - Default
                                 'pictures/'
```
