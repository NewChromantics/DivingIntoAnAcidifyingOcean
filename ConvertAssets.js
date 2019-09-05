Pop.Include('AssetImport.js');



function ConvertSceneFile(Filename,Pretty=false)
{
	const CachedFilename = GetCachedFilename(Filename,'scene');
	if ( Pop.FileExists(CachedFilename) )
	{
		//return;
	}
	const Scene = LoadSceneFile( Filename );
	const Json = Pretty ? JSON.stringify(Scene,null,'\t') : JSON.stringify(Scene);
	Pop.WriteStringToFile( CachedFilename, Json );
	//Pop.ShowFileInFinder( CachedFilename );
}



function ConvertGeometryFile(Filename,Pretty=false)
{
	Pop.Debug('ConvertGeometryFile',Filename);
	const CachedFilename = GetCachedFilename(Filename,'geometry');

	if ( Pop.FileExists(CachedFilename) )
	{
		//return;
	}
	Pop.Debug('ConvertGeometryFile','LoadGeometryFile');
	const Geo = LoadGeometryFile( Filename );
	//const Json = Pretty ? JSON.stringify(Geo,null,'\t') : JSON.stringify(Geo);
	Pop.Debug('ConvertGeometryFile','JSON.stringify');
	const Json = JSON.stringify(Geo);
	Pop.WriteStringToFile( CachedFilename, Json );
	//Pop.ShowFileInFinder( CachedFilename );
}


//	convert some assets

const GeoFiles =
[
 	'Logo/Logo.svg.json',
];
for ( let i=1;	i<=96;	i++ )
{
	let Filename = 'Ocean/ocean_pts.' + (''+i).padStart(4,'0');
	Filename += '.ply';
	GeoFiles.push(Filename);
}

const SceneFiles =
[
	'CameraSpline.dae.json'
];

SceneFiles.forEach( ConvertSceneFile );
GeoFiles.forEach( ConvertGeometryFile );

