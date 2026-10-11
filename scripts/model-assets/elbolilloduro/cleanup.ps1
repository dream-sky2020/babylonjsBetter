$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$stageRoot=[IO.Path]::GetFullPath((Join-Path $projectRoot '.asset-migration/elbolilloduro'))
$assetStageRoot=[IO.Path]::GetFullPath((Join-Path $projectRoot '.asset-migration'))
foreach($ancestor in @($projectRoot,$assetStageRoot,$stageRoot)){
 if(((Get-Item -LiteralPath $ancestor).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw "Refusing linked cleanup ancestor: $ancestor"}
}
$previousReport=Join-Path $stageRoot 'cleanup.json'
if(Test-Path -LiteralPath $previousReport){throw 'Cleanup report already exists; preserve it before running a second cleanup'}
$removed=@()
foreach($name in @('original-images','images','geometry','rigged','native','candidates','alternate-geometry','archive-only','normal-repair-backups','blender-extensions','electron-test')){
 $target=[IO.Path]::GetFullPath((Join-Path $stageRoot $name))
 if(-not $target.StartsWith($stageRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Cleanup path escapes task stage'}
 if(-not(Test-Path -LiteralPath $target)){continue}
 $items=@(Get-Item -LiteralPath $target)+@(Get-ChildItem -LiteralPath $target -Recurse -Force)
 if(@($items|Where-Object {($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0}).Count){throw "Refusing linked path: $target"}
 $files=@($items|Where-Object {-not $_.PSIsContainer})
 $bytes=[long](($files|Measure-Object Length -Sum).Sum)
 Remove-Item -LiteralPath $target -Recurse -Force
 $removed+=@{path=$target;bytes=$bytes;files=$files.Count}
}
$productionCache=[IO.Path]::GetFullPath((Join-Path $assetStageRoot 'production-electron-test'))
if(Test-Path -LiteralPath $productionCache){
 if(-not $productionCache.StartsWith($assetStageRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Production cache escapes workspace stage'}
 $items=@(Get-Item -LiteralPath $productionCache)+@(Get-ChildItem -LiteralPath $productionCache -Recurse -Force)
 if(@($items|Where-Object {($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0}).Count){throw 'Refusing linked production cache'}
 $files=@($items|Where-Object {-not $_.PSIsContainer});$bytes=[long](($files|Measure-Object Length -Sum).Sum)
 Remove-Item -LiteralPath $productionCache -Recurse -Force
 $removed+=@{path=$productionCache;bytes=$bytes;files=$files.Count}
}
$inventoryFile=Join-Path $projectRoot '.asset-migration-elbolilloduro-inventory.log'
if(Test-Path -LiteralPath $inventoryFile){Move-Item -LiteralPath $inventoryFile -Destination (Join-Path $stageRoot 'inventory.log')}
$report=@{date='2026-10-06';bytes=[long](($removed|Measure-Object bytes -Sum).Sum);removed=$removed;originalSourcesPreserved=$true;publishedAssetsPreserved=$true}
[IO.File]::WriteAllText($previousReport,($report|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
$report|ConvertTo-Json -Compress -Depth 5
