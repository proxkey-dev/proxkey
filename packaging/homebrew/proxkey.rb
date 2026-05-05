class Proxkey < Formula
  desc "CLI for ProxKey AI triage workflows"
  homepage "https://proxkey.dev"
  url "https://registry.npmjs.org/proxkey-cli/-/proxkey-cli-0.1.0.tgz"
  sha256 "babff88ac8c0a3431cf60e1b34f1b49ce2c51a0e614026050b74912ed0e042b3"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/proxkey version")
    assert_match "Usage:", shell_output("#{bin}/proxkey help")
  end
end
