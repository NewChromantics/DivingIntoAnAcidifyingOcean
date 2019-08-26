Pop.Include('AssetImport.js');



function ConvertSceneFile(Filename)
{
	const CachedFilename = Filename.replace('.dae.json','.scene.json');
	if ( Pop.FileExists(CachedFilename) )
	{
		//return;
	}
	const Scene = LoadSceneFile( Filename );
	const SceneJson = JSON.stringify(Scene,null,'\t');
	Pop.WriteStringToFile( CachedFilename, SceneJson );
	Pop.ShowFileInFinder( CachedFilename );
}



function ConvertGeometryFile(Filename)
{
	let CachedFilename = Filename;
	CachedFilename = CachedFilename.replace('.dae.json','.geometry.json');
	CachedFilename = Filename.replace('.ply','.geometry.json');
	CachedFilename = Filename.replace('.obj','.geometry.json');
	
	if ( Pop.FileExists(CachedFilename) )
	{
		//return;
	}
	const Geo = ParseGeometryFile( Filename );
	const GeoJson = JSON.stringify(Geo,null,'\t');
	Pop.WriteStringToFile( CachedFilename, GeoJson );
	Pop.ShowFileInFinder( CachedFilename );
}


//	convert some assets
const SceneFiles =
[
	'CameraSpline.dae.json'
];
SceneFiles.forEach( ConvertSceneFile );

const GeoFiles =
[
	'Models/shell_v001.ply'
];
GeoFiles.forEach( ConvertGeometryFile );


