cmake_minimum_required(VERSION 3.18)
project(occt_step_export LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(OpenCASCADE REQUIRED)

add_executable(occt_step_export main.cpp)
target_include_directories(occt_step_export PRIVATE ${OpenCASCADE_INCLUDE_DIR})
target_link_libraries(occt_step_export PRIVATE ${OpenCASCADE_LIBRARIES})
