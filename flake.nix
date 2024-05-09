{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
		flake-utils.url = "github:numtide/flake-utils";

		prettier-gohtml-nix.url = "github:diamondburned/prettier-gohtml-nix";
		prettier-gohtml-nix.inputs.nixpkgs.follows = "nixpkgs";
		prettier-gohtml-nix.inputs.flake-utils.follows = "flake-utils";
  };

	outputs = { self, nixpkgs, flake-utils, prettier-gohtml-nix }: 
		(flake-utils.lib.eachDefaultSystem (system:
			let
				pkgs = nixpkgs.legacyPackages.${system};
				lib  = pkgs.lib;
			in
			{
				devShells.default = pkgs.mkShell {
					packages = with pkgs; [
						go
						gopls
						go-tools
						sqlc
						deno
						esbuild
						prettier-gohtml-nix.packages.${system}.default
					];
				};

				packages.default = pkgs.buildGoModule {
					pname = "hrtclicker";
					version = self.rev or "dirty";
					subPackages = [ "cmd/hrt-clicker" ];
					src = self;

					vendorHash = "sha256-B50gCBfISKDXYYR2Q9RMSeaPtM9c38PJNjFD9EWV0qQ=";

					meta = with pkgs.stdenv.lib; {
						description = "A simple HTTP request tester";
						homepage = https://libdb.so/hrtclicker;
						mainProgram = "hrt-clicker";
					};
				};

				checks = let
					# Taken from https://github.com/Mic92/cntr/blob/master/vm-test.nix.
					makeTest' = pkgs.callPackage "${nixpkgs}/nixos/tests/make-test-python.nix";
					makeTest = args: makeTest' args {
						inherit pkgs system;
					};
				in {
					default = makeTest {
						name = "hrtclicker";
						nodes.server = { ... }: {
							imports = [
								self.nixosModules.default
							];

							services.hrtclicker = {
								enable = true;
								configPath = ./config.json;
								httpAddress = ":29384";
							};
						};

						testScript = lib.concatStringsSep "\n" [
							''start_all()''
							''server.wait_for_unit("hrtclicker.service")''
							''server.wait_for_open_port(29384)''
							''server.succeed("curl http://localhost:29384")''
							''server.succeed("curl -X POST http://localhost:29384/dosage/record")''
						];
					};
				};
			}
		)) // {
			nixosModules.default =
				{ config, lib, pkgs, ... }:

				with lib;
				with builtins;

				let
					cfg = config.services.hrtclicker;
				in
				{
					options.services.hrtclicker = {
						enable = mkEnableOption "Enable the hrtclicker service";

						httpAddress = mkOption {
							type = types.str;
							example = ":8080";
							description = ''
								Address to listen on. Supports Unix sockets via "unix:///path/to/socket".
							'';
						};

						databasePath = mkOption {
							type = types.path;
							default = "/var/lib/hrtclicker/hrtclicker.db";
							description = ''
								Path to the SQLite database file.
								The default uses systemd's RuntimeDirectory.
							'';
						};

						configPath = mkOption {
							type = types.path;
							example = "/etc/hrtclicker.json";
							description = ''
								Path to the hrtclicker.json configuration file.
								See https://github.com/diamondburned/hrtclicker/blob/main/config.json.
							'';
						};

						package = mkOption {
							type = types.package;
							default = self.packages.${pkgs.system}.default;
							description = ''
								The package to use for hrtclicker.
							'';
						};
					};

					config = mkIf cfg.enable {
						systemd.services.hrtclicker = {
							description = "hrtclicker systemd service";
							after = [ "network.target" ];
							wantedBy = [ "multi-user.target" ];
							serviceConfig = {
								ExecStart =
									with cfg;
									"${lib.getExe package} -c ${configPath} -l ${httpAddress} -db ${databasePath}";
								DynamicUser = true;
								StateDirectory = "hrtclicker";
								RuntimeDirectory = "hrtclicker";
								RuntimeDirectoryMode = "0777"; # maybe for unix sockets
								UMask = "0000";
							};
						};
					};
				};
		};
}
