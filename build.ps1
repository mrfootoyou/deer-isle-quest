<#
.SYNOPSIS
    A lightweight task runner for common repository tasks.
.DESCRIPTION
    This script defines a set of common repository tasks that can be executed from
    the command line.

    See the task definitions below for more details on each task and how to use them.

    PowerShell 7.4 or later is required to use this script. See https://aka.ms/install-powershell.
.EXAMPLE
    PS> ./build.ps1

    Executes the default 'build' task, including all of its dependencies (e.g. 'restore').
.EXAMPLE
    PS> ./build.ps1 list

    Lists all available tasks.
.EXAMPLE
    PS> ./build.ps1 test -noDeps

    Executes the 'test' task without executing its dependencies.
.NOTES
    SPDX-License-Identifier: Unlicense
    Source: http://github.com/mrfootoyou/pstaskframework
#>
#Requires -Version 7.4
# spell:ignore diegl,mmdc,minlag

[CmdletBinding(PositionalBinding = $false)]
param (
    # The name of the task(s) to execute.
    [Parameter(Position = 0)]
    [ValidateSet(
        'list',
        'bootstrap',
        'version',
        'clean',
        'build'
    )]
    [string[]]
    $TaskName = @('build'),

    # Task-specific arguments for the task specified in -TaskName.
    # Cannot be used when -TaskName contains multiple tasks.
    # Arguments are _not_ passed to dependencies of the specified task.
    #
    # Tip: Use `-- ` to clearly separate build-script arguments from task arguments.
    # Anything after the `-- ` will be passed verbatim to the invoked task.
    # For example:
    #   ./build.ps1 myTask -v -- -v
    # In this example, the first '-v' is shorthand for PowerShell's -Verbose argument,
    # while the second '-v' is passed to 'myTask' as a task-specific argument.
    [Parameter(ValueFromRemainingArguments)]
    [object[]] $TaskArgs,

    # When specified, dependencies of the task(s) will not be executed.
    # Default is execute all dependencies (and their dependencies).
    [Alias("noDeps")]
    [switch] $SkipDependencies
)
$ErrorActionPreference = 'Stop'

# Define the repository root and scripts directory. All tasks will be executed in the
# context of the repository root ($RepoRoot).
# Assume this script is located in the repository root.
$RepoRoot = $PSScriptRoot
$ScriptsDir = Convert-Path "$RepoRoot/scripts"

####################################################################################
# Define tasks variables
####################################################################################
# The properties of the $Variables dictionary will be imported as variables
# into each task prior to execution. This allows you to define common variables that
# are shared across all tasks, such as the repository root, scripts directory, or any
# other values that tasks may need.
#
# The following variables are always available:
# - $Task: The currently executing task definition.
# - $TaskName: The name of the currently executing task (same as $Task.Name).
# - $TaskArgs: An array of the arguments passed to the currently executing task.
# - $SkipDependencies: Indicates if the task's dependencies were executed.
# - $TasksToExecute: The ordered list of all tasks to execute.
# - $Variables: The dictionary of variables to import into each task's scope.
$Variables = @{
    RepoRoot   = $RepoRoot
    ScriptsDir = $ScriptsDir
    # Add more variables here as needed
}

# These scripts will be imported into each task prior to execution.
$ImportScripts = @(
    # Add more scripts here as needed
)

####################################################################################
# Define all tasks
####################################################################################
Import-Module "$ScriptsDir/PSTaskFramework" -Verbose:$false
Reset-TaskFramework

Task list -desc 'List all tasks' {
    Get-TaskFrameworkTasks | Format-Table Name, Description, DependsOn -AutoSize
}

Task bootstrap -desc 'Installs required tools' {
    <#
    .DESCRIPTION
        Bootstraps the repository by installing required tools.

        Required tools include:
        - Git (probably already installed, but we'll update if necessary).
        - PowerShell 7.4 or later (assumed to be already be installed).
        - ...
    #>
    param(
        # Forces use of Docker to run Mermaid CLI, even if a local installation is available.
        [switch] $UseDocker
    )
    Import-Module InstallHelpers -Verbose:$false
    . "$ScriptsDir/helpers.ps1"

    $dockerExists = testDockerExists
    if ($UseDocker -and !$dockerExists) {
        Write-Host "Docker is required to use the -UseDocker option. See https://www.docker.com/get-started." -ForegroundColor Magenta
        # keep going
    }
    if (!$UseDocker) {
        # Try to find Mermaid CLI locally. If it's not found or the version is too old,
        # we'll fall back to using Docker (if available).
        if (($mmdc = getLocalMermaidCliPath -ErrorAction Ignore)) {
            $mmdcVersion = getLocalMermaidCliVersion -ErrorAction Continue
            if (!$mmdcVersion) {
                # ignore installed mmdc if we can't determine the version
                $mmdc = $null
            }
            elseif ($mmdcVersion -ge $MermaidCliVersionMin) {
                Write-Host "Mermaid CLI $mmdcVersion is installed." -ForegroundColor Green
            }
            elseif ($dockerExists) {
                Write-Host "Mermaid CLI $mmdcVersion is installed but older than $MermaidCliVersionMin. Will use Docker image instead." -ForegroundColor Yellow
                $mmdc = $null
            }
            else {
                Write-Host "Mermaid CLI $mmdcVersion is installed but old. Consider upgrading to $MermaidCliVersionMin or later from https://mermaid.ai/." -ForegroundColor Yellow
            }
        }
        if (!$mmdc) {
            # don't override the user's choice if they explicitly specified -UseDocker:$false
            $UseDocker = !$PSBoundParameters.ContainsKey('UseDocker')
            if (!$UseDocker -or !$dockerExists) {
                Write-Host "Mermaid CLI $MermaidCliVersionMin (or later) or Docker is required to build the diagrams. See https://mermaid.ai/ or https://www.docker.com/get-started." -ForegroundColor Magenta
            }
        }
    }
    if ($UseDocker -and $dockerExists) {
        Write-Host "Pulling Mermaid CLI Docker image..." -ForegroundColor Blue
        Invoke-Shell -InformationAction Continue -- docker pull $MermaidDockerImageName
    }

    $appsToInstall = [ordered]@{
        'git'        = $null # well-known app
        'powershell' = $null # well-known app
    }
    Install-RequiredApp $appsToInstall -InstallPackageManagers -InformationAction Continue -Verbose:($VerbosePreference -eq 'Continue')
}

Task version -desc 'Display tool versions' {
    [PSCustomObject]@{
        'PowerShell'  = $PSVersionTable.PSVersion
        'OS Platform' = "$($PSVersionTable.OS) ($($PSVersionTable.Platform))"
        'RepoRoot'    = $RepoRoot
    } | Format-List
}

Task clean -desc 'Clean the repository' -DependsOn version {
    <#
    .DESCRIPTION
        Cleans the repository using 'git clean'. By default it will run in interactive mode,
        prompting the user to confirm which files to delete. To skip the confirmation prompt,
        use the -Force switch.

        By default this uses 'git clean -X' to remove all untracked files that are
        ignored by git (e.g. build outputs, .vs folders, etc). This is typically safer since
        it leaves behind untracked files that are _not_ ignored by git, such as new source files.

        If you want to remove all untracked files, including those not ignored by git, use
        the -Pristine switch to run 'git clean -x' instead.
    #>
    param(
        # If specified, will run 'git clean -x' instead of 'git clean -X'
        [switch]$Pristine,
        # If specified, will skip the confirmation prompt and run 'git clean' with the -force option.
        [switch]$Force
    )
    $cleanArgs = @(
        '-d' # remove untracked directories in addition to untracked files
        ($Pristine ? '-x' : '-X')
        ($Force ? '--force' : '--interactive')
        '--exclude=.env' # never delete .env files since they often contain secrets
    )
    Invoke-Shell -- git clean @cleanArgs
}

Task build -desc 'Build diagrams' -dependsOn version {
    <#
    .DESCRIPTION
        Builds the diagrams using Mermaid CLI.

        By default, it will use the local Mermaid CLI if available and up to date. If the
        local Mermaid CLI is not found or is outdated, it will fall back to using Docker
        if available. Otherwise, it will throw an error instructing the user to install
        Mermaid CLI or Docker.
    #>
    param(
        # The Mermaid diagram files to build, relative to the repository root. Default is
        # all .mmd files in the root.
        [string[]] $Diagrams = @('./*.mmd'),
        # The output image formats to generate for each diagram. Default is png and svg.
        [string[]] $ImageExtensions = @('png', 'svg'),
        # Forces use of Docker to run Mermaid CLI, even if a local installation is available.
        [switch] $UseDocker
    )

    $Diagrams = $Diagrams | Resolve-Path -Relative

    . "$ScriptsDir/helpers.ps1"

    $dockerExists = testDockerExists
    if ($UseDocker -and !$dockerExists) {
        throw "Docker is required to use the -UseDocker option. See https://www.docker.com/get-started."
    }

    if (!$UseDocker) {
        # Try to find Mermaid CLI locally. If it's not found or the version is too old,
        # we'll fall back to using Docker (if available).
        if (($mmdc = getLocalMermaidCliPath -ErrorAction Ignore)) {
            $mmdcVersion = getLocalMermaidCliVersion -ErrorAction Continue
            if (!$mmdcVersion) {
                # ignore installed mmdc if we can't determine the version
                $mmdc = $null
            }
            elseif ($mmdcVersion -ge $MermaidCliVersionMin) {
                # all good
            }
            elseif ($dockerExists) {
                Write-Host "Mermaid CLI $mmdcVersion is installed but older than $MermaidCliVersionMin. Will use Docker image instead." -ForegroundColor Yellow
                $mmdc = $null
            }
            else {
                Write-Host "Mermaid CLI $mmdcVersion is installed but old. Consider upgrading to $MermaidCliVersionMin or later from https://mermaid.ai/." -ForegroundColor Yellow
            }
        }
        if (!$mmdc) {
            # don't override the user's choice if they explicitly specified -UseDocker:$false
            $UseDocker = !$PSBoundParameters.ContainsKey('UseDocker')
            if (!$UseDocker -or !$dockerExists) {
                throw "Mermaid CLI $MermaidCliVersionMin (or later) or Docker is required to build the diagrams. See https://mermaid.ai/ or https://www.docker.com/get-started."
            }
        }
    }

    $pathSepChar = [System.IO.Path]::DirectorySeparatorChar
    function convertPath ($path) { "$path" -replace '[\\/]', $pathSepChar }

    if ($UseDocker) {
        $pathSepChar = '/' # container expects POSIX-style paths

        $dockerRunArgs = @(
            'run'
            '--rm'
            '-it'
            '--volume', '.:/data'
            if ($IsLinux -or $IsMacOS) { '--user', "$(id -u):$(id -g)" }
            $MermaidDockerImageName
        )

        $mmdcVersion = Invoke-Shell -- docker @dockerRunArgs --version
        Write-Host "Using Mermaid CLI $mmdcVersion in Docker image $MermaidDockerImageName." -ForegroundColor Green
    }
    else {
        Write-Host "Using Mermaid CLI $mmdcVersion." -ForegroundColor Green
    }

    foreach ($filePath in $Diagrams) {
        foreach ($ext in $ImageExtensions) {
            $fileName = [System.IO.Path]::GetFileName($filePath)
            $imagePath = "docs/generated/$([System.IO.Path]::ChangeExtension($fileName, $ext))"
            Write-Host "Processing: '$filePath' -> '$imagePath'"

            $mmdcArgs = @(
                '--input', (convertPath $filePath)
                '--output', (convertPath $imagePath)
                '--scale', '4'
                '--svgId', 'diegl'
                '--configFile', (convertPath 'docs/generated/mermaid-config.json')
                if (!$UseDocker) { '--puppeteerConfigFile', (convertPath 'docs/generated/puppeteer-config.json') }
            )

            if ($UseDocker) {
                Invoke-Shell -InformationAction $InformationPreference -- docker @dockerRunArgs @mmdcArgs
            }
            else {
                Invoke-Shell -InformationAction $InformationPreference -- $mmdc @mmdcArgs
            }
        }
    }
}

##############################################################
# Execute the specified task(s) with the Task Framework. See
# the documentation for Invoke-TaskFramework for more details.
##############################################################

Invoke-TaskFramework `
    -TaskName $TaskName `
    -TaskArgs $TaskArgs `
    -SkipDependencies:$SkipDependencies `
    -WorkingDirectory $RepoRoot `
    -Variables $Variables `
    -ImportScripts $ImportScripts `
    -ExitOnError `
    -InformationAction Continue `
    -Verbose:($VerbosePreference -eq 'Continue')
