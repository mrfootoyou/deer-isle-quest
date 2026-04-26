#Requires -Version 7.4
# spell:ignore mmdc
param()

$MermaidCliVersionMin = [version]'11.12.0'
$MermaidDockerImageName = "docker.io/minlag/mermaid-cli:$MermaidCliVersionMin"
$null = $MermaidDockerImageName # avoid "assigned but not used" warning

Import-Module "$PSScriptRoot/PSTaskFramework/BuildHelpers"

function testDockerExists {
    $null -ne (Assert-AppExists 'docker' -PassThru -ErrorAction Ignore)
}

function getLocalMermaidCliPath {
    [CmdletBinding()]
    [OutputType([string])]
    param()
    Assert-AppExists 'mmdc' -PassThru
}

function getLocalMermaidCliVersion {
    [CmdletBinding()]
    [OutputType([version])]
    param()

    $mmdc = Assert-AppExists 'mmdc' -PassThru
    if (!$mmdc) { return }

    $mmdcVersion = Invoke-Shell -InformationAction Ignore -- $mmdc --version
    if ("$mmdcVersion" -match '\d+\.\d+\.\d+') {
        return [version]$Matches[0]
    }

    Write-Error "Unable to determine Mermaid CLI version from '$mmdc' : $mmdcVersion"
}
