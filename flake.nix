{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";

  outputs = { nixpkgs, ... }:

    let
      systems = [ "aarch64-darwin" "x86_64-darwin" "x86_64-linux" "aarch64-linux" ];
      forEachSystem = nixpkgs.lib.genAttrs systems;

    in
    {
      devShells = forEachSystem (system:

        let
          pkgs = import nixpkgs { inherit system; };

          chosenNode = pkgs.nodejs_24;
          chosenPnpm = pkgs.pnpm.override { nodejs = chosenNode; };

        in
        {
          buildtime = pkgs.mkShell {
            packages = [
              chosenNode
              chosenPnpm
            ];

            NODE_BINARY = "${chosenNode}/bin/node";
            PNPM_BINARY = "${chosenPnpm}/bin/pnpm";

            BUILD_COMMAND = "pnpm build";
            UPDATE_IDIOMATIC_LOCK_COMMAND = "pnpm install --lockfile-only";

            IDE_PATH_VARS = "NODE_BINARY PNPM_BINARY";

            RELEASE_TYPE = "static";
          };
        }

      );
    };
}
