package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	"os/signal"

	"golang.org/x/sync/errgroup"
	"libdb.so/hrtclicker"
	"libdb.so/hrtclicker/db"
	"libdb.so/hrtclicker/notify"
	"libdb.so/hrtclicker/server"
	"libdb.so/hrtclicker/web"
	"libdb.so/hserve"
	"libdb.so/tmplutil"
)

var (
	configPath   = "config.json"
	httpAddress  = ":8375"
	databasePath = "/tmp/hrt-clicker.db"
)

func main() {
	flag.StringVar(&configPath, "c", configPath, "path to the configuration file")
	flag.StringVar(&httpAddress, "l", httpAddress, "address to listen on for HTTP requests")
	flag.StringVar(&databasePath, "db", databasePath, "path to the SQLite database file")
	flag.Parse()

	if !run(context.Background()) {
		os.Exit(1)
	}
}

func run(ctx context.Context) bool {
	ctx, cancel := signal.NotifyContext(ctx, os.Interrupt)
	defer cancel()

	cfg, err := hrtclicker.ReadJSONConfigFile(configPath)
	if err != nil {
		slog.Error(
			"failed to read config",
			"config_path", configPath,
			"err", err)
		return false
	}

	var tmpl *web.Templates
	if s, err := os.Stat("web"); err == nil && s.IsDir() {
		// We're running from the source directory. Use that directly.
		fs := os.DirFS("web")
		slog.Info("using local web templates")

		tmpl, err = web.NewTemplates(fs)
		if err != nil {
			slog.Error(
				"failed to create local templates",
				"err", err)
			return false
		}

		// Force templates to be reloaded on every request.
		tmplutil.DebugMode = true
	} else {
		slog.Debug("using embedded web templates")
		tmpl = web.EmbeddedTemplates()
	}

	db, err := db.Open(databasePath)
	if err != nil {
		slog.Error(
			"failed to open database",
			"database_path", databasePath,
			"err", err)
		return false
	}
	defer db.Close()

	errg, ctx := errgroup.WithContext(ctx)

	errg.Go(func() error {
		slog.Info(
			"starting server",
			"http_address", httpAddress)

		server := server.New(server.Dependencies{
			Logger:    slog.Default().With("component", "http"),
			Database:  db,
			Config:    cfg,
			Templates: tmpl,
		})

		if err := hserve.ListenAndServe(ctx, httpAddress, server); err != nil {
			slog.Error(
				"failed to serve HTTP server",
				"http_address", httpAddress,
				"err", err)
			return err
		}

		return nil
	})

	errg.Go(func() error {
		monitor := notify.NewMonitor(notify.Dependencies{
			Logger:   slog.Default().With("component", "monitor"),
			Config:   cfg,
			Database: db,
		})

		if err := monitor.Run(ctx); err != nil {
			slog.Error(
				"failed to run monitor",
				"err", err)
			return err
		}

		return nil
	})

	return errg.Wait() == nil
}
