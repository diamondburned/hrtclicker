package hrtclicker

import (
	"encoding/json"
	"fmt"
	"io"
	"os"

	"libdb.so/hrtclicker/internal/cfgtypes"
)

// Config contains the configuration for the hrtclicker application.
// See config.json for an example configuration.
type Config struct {
	DatabasePath  string `json:"database_path"`
	ListenAddress string `json:"listen_address"`
	HRT           struct {
		Type     HRTType           `json:"type"`
		Interval cfgtypes.Duration `json:"interval"`
	} `json:"hrt"`
	Gotify struct {
		Endpoint     string       `json:"endpoint"`
		Token        string       `json:"token"`
		Notification Notification `json:"notification"`
	} `json:"gotify"`
}

// ReadJSONConfig reads a Config from the provided io.Reader in JSON format.
func ReadJSONConfig(r io.Reader) (*Config, error) {
	var cfg Config
	if err := json.NewDecoder(r).Decode(&cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

// ReadJSONConfigFile reads a Config from the provided file path as a JSON file.
func ReadJSONConfigFile(path string) (*Config, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open config file: %w", err)
	}
	defer f.Close()
	return ReadJSONConfig(f)
}
