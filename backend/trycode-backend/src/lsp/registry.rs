use crate::lsp::types::*;
use std::collections::HashMap;

/// 预定义的语言服务器配置注册表
pub fn get_default_lsp_servers() -> Vec<LSPServerRegistration> {
    vec![
        // ===== Tier 1: 常驻核心语言 =====
        LSPServerRegistration {
            language_id: "python".to_string(),
            config: LSPServerConfig {
                language_id: "python".to_string(),
                command: "pyright-langserver".to_string(),
                args: vec!["--stdio".to_string()],
                env: None,
                memory_limit_mb: 256,
                startup_mode: StartupMode::Resident,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 100,
        },
        LSPServerRegistration {
            language_id: "typescript".to_string(),
            config: LSPServerConfig {
                language_id: "typescript".to_string(),
                command: "typescript-language-server".to_string(),
                args: vec!["--stdio".to_string()],
                env: None,
                memory_limit_mb: 200,
                startup_mode: StartupMode::Resident,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 100,
        },
        LSPServerRegistration {
            language_id: "javascript".to_string(),
            config: LSPServerConfig {
                language_id: "javascript".to_string(),
                command: "typescript-language-server".to_string(),
                args: vec!["--stdio".to_string()],
                env: None,
                memory_limit_mb: 200,
                startup_mode: StartupMode::Resident,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 100,
        },

        // ===== Tier 2: 按需启动核心语言 =====
        LSPServerRegistration {
            language_id: "rust".to_string(),
            config: LSPServerConfig {
                language_id: "rust".to_string(),
                command: "rust-analyzer".to_string(),
                args: vec![],
                env: None,
                memory_limit_mb: 300,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 600,
                max_restarts: 3,
                restart_delay_secs: 10,
            },
            priority: 90,
        },
        LSPServerRegistration {
            language_id: "go".to_string(),
            config: LSPServerConfig {
                language_id: "go".to_string(),
                command: "gopls".to_string(),
                args: vec!["serve".to_string()],
                env: None,
                memory_limit_mb: 150,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 90,
        },
        LSPServerRegistration {
            language_id: "cpp".to_string(),
            config: LSPServerConfig {
                language_id: "cpp".to_string(),
                command: "clangd".to_string(),
                args: vec!["--background-index".to_string(), "--clang-tidy".to_string()],
                env: None,
                memory_limit_mb: 200,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 80,
        },
        LSPServerRegistration {
            language_id: "c".to_string(),
            config: LSPServerConfig {
                language_id: "c".to_string(),
                command: "clangd".to_string(),
                args: vec!["--background-index".to_string(), "--clang-tidy".to_string()],
                env: None,
                memory_limit_mb: 200,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 80,
        },

        // ===== Tier 3: 按需启动其他语言 =====
        LSPServerRegistration {
            language_id: "java".to_string(),
            config: LSPServerConfig {
                language_id: "java".to_string(),
                command: "java".to_string(),
                args: vec![
                    "-Declipse.application=org.eclipse.jdt.ls.core.id1".to_string(),
                    "-Dosgi.bundles.defaultStartLevel=4".to_string(),
                    "-Declipse.product=org.eclipse.jdt.ls.core.product".to_string(),
                    "-Dlog.level=ALL".to_string(),
                    "-Xms256m".to_string(),
                    "-Xmx512m".to_string(),
                    "-jar".to_string(),
                    "/opt/lsp-servers/jdt-language-server/plugins/org.eclipse.equinox.launcher_*.jar".to_string(),
                    "-configuration".to_string(),
                    "/opt/lsp-servers/jdt-language-server/config_linux".to_string(),
                    "-data".to_string(),
                    "/workspace/.jdt".to_string(),
                ],
                env: None,
                memory_limit_mb: 400,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 900,
                max_restarts: 2,
                restart_delay_secs: 15,
            },
            priority: 70,
        },
        LSPServerRegistration {
            language_id: "csharp".to_string(),
            config: LSPServerConfig {
                language_id: "csharp".to_string(),
                command: "dotnet".to_string(),
                args: vec!["/opt/lsp-servers/omnisharp/OmniSharp.dll".to_string(), "--languageserver".to_string(), "--hostpid".to_string(), "0".to_string()],
                env: None,
                memory_limit_mb: 300,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 600,
                max_restarts: 2,
                restart_delay_secs: 10,
            },
            priority: 70,
        },
        LSPServerRegistration {
            language_id: "php".to_string(),
            config: LSPServerConfig {
                language_id: "php".to_string(),
                command: "intelephense".to_string(),
                args: vec!["--stdio".to_string()],
                env: None,
                memory_limit_mb: 150,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 60,
        },
        LSPServerRegistration {
            language_id: "ruby".to_string(),
            config: LSPServerConfig {
                language_id: "ruby".to_string(),
                command: "ruby-lsp".to_string(),
                args: vec![],
                env: None,
                memory_limit_mb: 150,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 60,
        },
        LSPServerRegistration {
            language_id: "swift".to_string(),
            config: LSPServerConfig {
                language_id: "swift".to_string(),
                command: "sourcekit-lsp".to_string(),
                args: vec![],
                env: None,
                memory_limit_mb: 300,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 600,
                max_restarts: 2,
                restart_delay_secs: 10,
            },
            priority: 60,
        },
        LSPServerRegistration {
            language_id: "kotlin".to_string(),
            config: LSPServerConfig {
                language_id: "kotlin".to_string(),
                command: "kotlin-language-server".to_string(),
                args: vec![],
                env: None,
                memory_limit_mb: 300,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 600,
                max_restarts: 2,
                restart_delay_secs: 10,
            },
            priority: 60,
        },
        LSPServerRegistration {
            language_id: "scala".to_string(),
            config: LSPServerConfig {
                language_id: "scala".to_string(),
                command: "metals".to_string(),
                args: vec![],
                env: None,
                memory_limit_mb: 500,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 600,
                max_restarts: 2,
                restart_delay_secs: 15,
            },
            priority: 60,
        },
        LSPServerRegistration {
            language_id: "r".to_string(),
            config: LSPServerConfig {
                language_id: "r".to_string(),
                command: "r-languageserver".to_string(),
                args: vec![],
                env: None,
                memory_limit_mb: 200,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 50,
        },
        LSPServerRegistration {
            language_id: "lua".to_string(),
            config: LSPServerConfig {
                language_id: "lua".to_string(),
                command: "lua-language-server".to_string(),
                args: vec!["--stdio".to_string()],
                env: None,
                memory_limit_mb: 100,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 50,
        },
        LSPServerRegistration {
            language_id: "perl".to_string(),
            config: LSPServerConfig {
                language_id: "perl".to_string(),
                command: "perl-language-server".to_string(),
                args: vec!["--stdio".to_string()],
                env: None,
                memory_limit_mb: 100,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 50,
        },
        LSPServerRegistration {
            language_id: "dart".to_string(),
            config: LSPServerConfig {
                language_id: "dart".to_string(),
                command: "dart".to_string(),
                args: vec!["language-server".to_string()],
                env: None,
                memory_limit_mb: 200,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 50,
        },
        LSPServerRegistration {
            language_id: "zig".to_string(),
            config: LSPServerConfig {
                language_id: "zig".to_string(),
                command: "zls".to_string(),
                args: vec![],
                env: None,
                memory_limit_mb: 200,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 50,
        },
        LSPServerRegistration {
            language_id: "julia".to_string(),
            config: LSPServerConfig {
                language_id: "julia".to_string(),
                command: "julia".to_string(),
                args: vec!["--project=@stdlib".to_string(), "-e".to_string(), "using LanguageServer; LanguageServer.runserver()".to_string()],
                env: None,
                memory_limit_mb: 300,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 600,
                max_restarts: 2,
                restart_delay_secs: 10,
            },
            priority: 50,
        },
        LSPServerRegistration {
            language_id: "haskell".to_string(),
            config: LSPServerConfig {
                language_id: "haskell".to_string(),
                command: "haskell-language-server-wrapper".to_string(),
                args: vec!["--lsp".to_string()],
                env: None,
                memory_limit_mb: 300,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 600,
                max_restarts: 2,
                restart_delay_secs: 10,
            },
            priority: 50,
        },
        LSPServerRegistration {
            language_id: "fortran".to_string(),
            config: LSPServerConfig {
                language_id: "fortran".to_string(),
                command: "fortls".to_string(),
                args: vec![],
                env: None,
                memory_limit_mb: 150,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 40,
        },
        LSPServerRegistration {
            language_id: "objectivec".to_string(),
            config: LSPServerConfig {
                language_id: "objectivec".to_string(),
                command: "clangd".to_string(),
                args: vec!["--background-index".to_string()],
                env: None,
                memory_limit_mb: 200,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 40,
        },
        LSPServerRegistration {
            language_id: "vbnet".to_string(),
            config: LSPServerConfig {
                language_id: "vbnet".to_string(),
                command: "dotnet".to_string(),
                args: vec!["/opt/lsp-servers/omnisharp/OmniSharp.dll".to_string(), "--languageserver".to_string()],
                env: None,
                memory_limit_mb: 300,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 600,
                max_restarts: 2,
                restart_delay_secs: 10,
            },
            priority: 40,
        },
        LSPServerRegistration {
            language_id: "fsharp".to_string(),
            config: LSPServerConfig {
                language_id: "fsharp".to_string(),
                command: "dotnet".to_string(),
                args: vec!["/opt/lsp-servers/ionide/FSharpLanguageServer.dll".to_string()],
                env: None,
                memory_limit_mb: 300,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 600,
                max_restarts: 2,
                restart_delay_secs: 10,
            },
            priority: 40,
        },
        LSPServerRegistration {
            language_id: "groovy".to_string(),
            config: LSPServerConfig {
                language_id: "groovy".to_string(),
                command: "groovy-language-server".to_string(),
                args: vec![],
                env: None,
                memory_limit_mb: 200,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 40,
        },
        LSPServerRegistration {
            language_id: "html".to_string(),
            config: LSPServerConfig {
                language_id: "html".to_string(),
                command: "vscode-html-languageserver".to_string(),
                args: vec!["--stdio".to_string()],
                env: None,
                memory_limit_mb: 150,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 50,
        },
        LSPServerRegistration {
            language_id: "css".to_string(),
            config: LSPServerConfig {
                language_id: "css".to_string(),
                command: "vscode-css-languageserver".to_string(),
                args: vec!["--stdio".to_string()],
                env: None,
                memory_limit_mb: 150,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 50,
        },
        LSPServerRegistration {
            language_id: "json".to_string(),
            config: LSPServerConfig {
                language_id: "json".to_string(),
                command: "vscode-json-languageserver".to_string(),
                args: vec!["--stdio".to_string()],
                env: None,
                memory_limit_mb: 100,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 50,
        },
        LSPServerRegistration {
            language_id: "yaml".to_string(),
            config: LSPServerConfig {
                language_id: "yaml".to_string(),
                command: "yaml-language-server".to_string(),
                args: vec!["--stdio".to_string()],
                env: None,
                memory_limit_mb: 100,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 50,
        },
        LSPServerRegistration {
            language_id: "sql".to_string(),
            config: LSPServerConfig {
                language_id: "sql".to_string(),
                command: "sql-language-server".to_string(),
                args: vec!["--stdio".to_string()],
                env: None,
                memory_limit_mb: 150,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 50,
        },
        LSPServerRegistration {
            language_id: "bash".to_string(),
            config: LSPServerConfig {
                language_id: "bash".to_string(),
                command: "bash-language-server".to_string(),
                args: vec!["start".to_string()],
                env: None,
                memory_limit_mb: 100,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 50,
        },
        LSPServerRegistration {
            language_id: "powershell".to_string(),
            config: LSPServerConfig {
                language_id: "powershell".to_string(),
                command: "powershell".to_string(),
                args: vec!["-NoProfile".to_string(), "-Command".to_string(), "Start-PowerShellEditorServices -Stdio".to_string()],
                env: None,
                memory_limit_mb: 200,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 40,
        },
        LSPServerRegistration {
            language_id: "dockerfile".to_string(),
            config: LSPServerConfig {
                language_id: "dockerfile".to_string(),
                command: "dockerfile-language-server-nodejs".to_string(),
                args: vec!["--stdio".to_string()],
                env: None,
                memory_limit_mb: 100,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 40,
        },
        LSPServerRegistration {
            language_id: "vue".to_string(),
            config: LSPServerConfig {
                language_id: "vue".to_string(),
                command: "vue-language-server".to_string(),
                args: vec!["--stdio".to_string()],
                env: None,
                memory_limit_mb: 200,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 40,
        },
        LSPServerRegistration {
            language_id: "svelte".to_string(),
            config: LSPServerConfig {
                language_id: "svelte".to_string(),
                command: "svelteserver".to_string(),
                args: vec!["--stdio".to_string()],
                env: None,
                memory_limit_mb: 200,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 40,
        },
        LSPServerRegistration {
            language_id: "toml".to_string(),
            config: LSPServerConfig {
                language_id: "toml".to_string(),
                command: "taplo".to_string(),
                args: vec!["lsp".to_string(), "stdio".to_string()],
                env: None,
                memory_limit_mb: 100,
                startup_mode: StartupMode::OnDemand,
                idle_timeout_secs: 300,
                max_restarts: 3,
                restart_delay_secs: 5,
            },
            priority: 30,
        },
    ]
}

/// 获取语言 ID 到 LSP 配置的映射
pub fn get_language_lsp_configs() -> HashMap<String, LSPServerConfig> {
    let registrations = get_default_lsp_servers();
    let mut map = HashMap::new();
    for reg in registrations {
        map.insert(reg.language_id.clone(), reg.config);
    }
    map
}

/// 获取按优先级排序的语言列表
pub fn get_languages_by_priority() -> Vec<String> {
    let mut registrations = get_default_lsp_servers();
    registrations.sort_by_key(|r| -r.priority);
    registrations.into_iter().map(|r| r.language_id).collect()
}

/// 获取常驻语言列表
pub fn get_resident_languages() -> Vec<String> {
    get_default_lsp_servers()
        .into_iter()
        .filter(|r| r.config.startup_mode == StartupMode::Resident)
        .map(|r| r.language_id)
        .collect()
}

/// 获取按需启动语言列表
pub fn get_on_demand_languages() -> Vec<String> {
    get_default_lsp_servers()
        .into_iter()
        .filter(|r| r.config.startup_mode == StartupMode::OnDemand)
        .map(|r| r.language_id)
        .collect()
}

/// 获取语言的内存限制
pub fn get_language_memory_limit(language_id: &str) -> u64 {
    get_default_lsp_servers()
        .into_iter()
        .find(|r| r.language_id == language_id)
        .map(|r| r.config.memory_limit_mb)
        .unwrap_or(100)
}

/// 获取语言的空闲超时时间
pub fn get_language_idle_timeout(language_id: &str) -> u64 {
    get_default_lsp_servers()
        .into_iter()
        .find(|r| r.language_id == language_id)
        .map(|r| r.config.idle_timeout_secs)
        .unwrap_or(300)
}

/// 检查语言是否支持 LSP
pub fn is_lsp_supported(language_id: &str) -> bool {
    get_default_lsp_servers()
        .into_iter()
        .any(|r| r.language_id == language_id)
}

/// 获取语言的 LSP 启动命令（用于调试/手动启动）
pub fn get_lsp_start_command(language_id: &str) -> Option<String> {
    get_default_lsp_servers()
        .into_iter()
        .find(|r| r.language_id == language_id)
        .map(|r| {
            let mut cmd = r.config.command.clone();
            if !r.config.args.is_empty() {
                cmd.push(' ');
                cmd.push_str(&r.config.args.join(" "));
            }
            cmd
        })
}

/// 获取语言服务器安装检查命令
pub fn get_lsp_check_command(language_id: &str) -> Option<String> {
    match language_id {
        "python" => Some("pyright-langserver --version".to_string()),
        "typescript" | "javascript" => Some("typescript-language-server --version".to_string()),
        "rust" => Some("rust-analyzer --version".to_string()),
        "go" => Some("gopls version".to_string()),
        "cpp" | "c" => Some("clangd --version".to_string()),
        "java" => Some("java -version".to_string()),
        "csharp" => Some("dotnet --version".to_string()),
        "php" => Some("intelephense --version".to_string()),
        "ruby" => Some("ruby-lsp --version".to_string()),
        "swift" => Some("sourcekit-lsp --version".to_string()),
        "kotlin" => Some("kotlin-language-server --version".to_string()),
        "scala" => Some("metals --version".to_string()),
        "r" => Some("r-languageserver --version".to_string()),
        "lua" => Some("lua-language-server --version".to_string()),
        "perl" => Some("perl-language-server --version".to_string()),
        "dart" => Some("dart --version".to_string()),
        "zig" => Some("zls --version".to_string()),
        "julia" => Some("julia --version".to_string()),
        "haskell" => Some("haskell-language-server-wrapper --version".to_string()),
        "fortran" => Some("fortls --version".to_string()),
        "objectivec" => Some("clangd --version".to_string()),
        "vbnet" | "fsharp" => Some("dotnet --version".to_string()),
        "groovy" => Some("groovy-language-server --version".to_string()),
        "html" | "css" | "json" => Some("vscode-html-languageserver --version".to_string()),
        "yaml" => Some("yaml-language-server --version".to_string()),
        "sql" => Some("sql-language-server --version".to_string()),
        "bash" => Some("bash-language-server --version".to_string()),
        "powershell" => Some("pwsh -Command \"Get-Module -ListAvailable PowerShellEditorServices\"".to_string()),
        "dockerfile" => Some("dockerfile-language-server-nodejs --version".to_string()),
        "vue" => Some("vue-language-server --version".to_string()),
        "svelte" => Some("svelteserver --version".to_string()),
        "toml" => Some("taplo --version".to_string()),
        _ => None,
    }
}