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
    PS> ./build.ps1 clean -noDeps

    Executes the 'clean' task without executing its dependencies.
.EXAMPLE
    PS> ./build.ps1 help clean -full

    Displays the help documentation for the 'clean' task.
    Run `./build.ps1 help help -full` for more information on the help system.
.NOTES
    SPDX-License-Identifier: Unlicense
    Source: http://github.com/mrfootoyou/pstaskframework
#>
#Requires -Version 7.4
# spell:ignore dpnt mmdc infa

[Diagnostics.CodeAnalysis.SuppressMessage('PSReviewUnusedParameter', '')]
[Diagnostics.CodeAnalysis.SuppressMessage('PSAvoidGlobalVars', 'global:LastTaskContext')]
[CmdletBinding(PositionalBinding = $false)]
param (
    # The name of the task(s) to execute.
    [Parameter(Position = 0)]
    [ValidateSet(
        'list',
        'help',
        'bootstrap',
        'version',
        'clean',
        'build'
    )]
    [string[]] $TaskName = @('build'),

    # When specified, dependencies of the task(s) will not be executed.
    # Default is execute all dependencies (and their dependencies).
    [Alias("noDeps")]
    [switch] $SkipDependencies,

    # Receives task-specific arguments for the _single task_ specified in -TaskName.
    [Parameter(ValueFromRemainingArguments, DontShow)]
    [ValidateNotNull()]
    [object[]] $TaskArgs = @()
)
# Initialize some default PowerShell preferences...
$ErrorActionPreference = 'Stop'     # throw exception on any unhandled error
$InformationPreference = 'Continue' # display informational messages

# Initialize some repository variables...
$RepoRoot = $PSScriptRoot # assumes this script is located in the repo root
$ScriptsDir = Convert-Path "$RepoRoot/scripts"

# Import and initialize the PSTaskFramework...
Import-Module "$ScriptsDir/PSTaskFramework" -Verbose:$false
$TaskContext = Initialize-TaskFramework

####################################################################################
# Define shared variables and functions...
####################################################################################


####################################################################################
# Define all tasks
# - Tasks will execute in the order they are defined below, unless they have
#   dependencies, in which case the dependencies will always be executed first.
# - The task's working directory is the folder containing this script.
# - Tasks can assign values to script-scope variables using the `$script:` modifier.
####################################################################################
#region Task definitions

# Add the default list and help tasks...
Add-TaskFrameworkDefaultTasks list, help

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

    $dockerExists = Test-DockerExists
    if ($UseDocker -and !$dockerExists) {
        Write-Host "Docker is required to use the -UseDocker option. See https://www.docker.com/get-started." -ForegroundColor Magenta
        # keep going
    }
    if (!$UseDocker) {
        # Try to find Mermaid CLI locally. If it's not found or the version is too old,
        # we'll fall back to using Docker (if available).
        if (($mmdc = Assert-AppExists 'mmdc' -PassThru -ErrorAction Ignore)) {
            $mmdcVersion = Invoke-Shell -infa Ignore -ea Continue -- mmdc --version
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
            $UseDocker = $dockerExists -and !$PSBoundParameters.ContainsKey('UseDocker')
            if (!$UseDocker -and !(Test-NpmExists)) {
                Write-Host "Mermaid CLI $MermaidCliVersionMin (or later) or Docker or Node.js is required to build the diagrams. See https://mermaid.ai/ or https://www.docker.com/get-started." -ForegroundColor Magenta
            }
        }
    }
    if ($UseDocker) {
        Write-Host "Pulling Mermaid CLI Docker image..." -ForegroundColor Blue
        Invoke-Shell -- docker pull $MermaidDockerImage
    }

    $appsToInstall = [ordered]@{
        'git'        = $null # well-known app
        'powershell' = $null # well-known app
    }
    Install-RequiredApp $appsToInstall -InstallPackageManagers -Verbose:($VerbosePreference -eq 'Continue')
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
    . "$ScriptsDir/helpers.ps1"

    $Diagrams = $Diagrams | Resolve-Path -Relative

    $dockerArgs = @{}
    if ($PSBoundParameters.ContainsKey('UseDocker')) {
        $dockerArgs['UseDocker'] = $UseDocker.IsPresent
    }

    foreach ($filePath in $Diagrams) {
        $fileBaseName = Split-Path $filePath -LeafBase
        foreach ($ext in $ImageExtensions.foreach{ $_.TrimStart('.').ToLower() }) {
            $imagePath = "./docs/generated/$fileBaseName.$ext"

            Convert-MermaidFileToImage $filePath $imagePath @dockerArgs

            if ($ext -eq 'png') {
                Optimize-PngImage $imagePath @dockerArgs
            }
            if ($ext -eq 'svg') {
                Optimize-SvgImage $imagePath @dockerArgs
            }
        }
    }
}

#endregion Task definitions

####################################################################################
# Execute the specified task(s)...
####################################################################################
try {
    Invoke-TaskFramework `
        -TaskName $TaskName `
        -TaskArgs $TaskArgs `
        -SkipDependencies:$SkipDependencies `
        -ExitOnError
}
finally {
    # Save TaskContext in a global variable so that it can be inspected
    $global:LastTaskContext = $TaskContext
}
