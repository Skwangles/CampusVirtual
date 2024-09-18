#pragma once

#include <string>
#include <vector>

class image_sequence {
public:
    struct frame {
        frame(const std::string& img_path)
            : img_path_(img_path){};

        const std::string img_path_;
    };

    image_sequence(const std::string& img_dir_path);

    virtual ~image_sequence() = default;

    std::vector<frame> get_frames() const;

private:
    std::vector<std::string> img_file_paths_;
};
