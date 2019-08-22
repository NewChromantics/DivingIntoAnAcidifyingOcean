
function HideLogo()
{
	let HideHud = function(Name)
	{
		let Div = new Pop.Hud.Label(Name);
		Div.SetVisible(false);
	}

	HideHud('TitleText');
	HideHud('Hint_Start');
	HideHud('Hint_Headphones');
	HideHud('IconHeadphones');
}

const PreloadFilenames =
[
	'Timeline.json',
	'CameraSpline.dae.json',
	'Shell/shellFromBlender.obj',
	'Quad.vert.glsl',
	'ParticleTriangles.vert.glsl',
	'ParticleColour.frag.glsl',
	'BlitCopy.frag.glsl',
	'Geo.vert.glsl',
	'Colour.frag.glsl',
	'Edge.frag.glsl',
	'PhysicsIteration_UpdateVelocity.frag.glsl',
	'PhysicsIteration_UpdatePosition.frag.glsl',

	'AcidicOcean.js',
 'AssetManager.js',
 'AudioManager.js',
	'Hud.js',
	'PopEngineCommon/PopShaderCache.js',
	'PopEngineCommon/PopFrameCounter.js',
	'PopEngineCommon/PopCamera.js',
	'PopEngineCommon/PopMath.js',
	'PopEngineCommon/ParamsWindow.js',
	'PopEngineCommon/PopPly.js',
	'PopEngineCommon/PopObj.js',
	'PopEngineCommon/PopCollada.js',
	'PopEngineCommon/PopTexture.js',
	'Noise0.png',
 null
];
function PreloadOceanFilenames()
{
	let LoadOceanFrames = 96;
	if ( Pop.GetExeArguments().includes('ShortOcean') )
		LoadOceanFrames = 4;
	for ( let i=1;	i<=LoadOceanFrames;	i++ )
	{
		let Filename = 'Ocean/ocean_pts.' + (''+i).padStart(4,'0') + '.ply.mesh.json';
		PreloadFilenames.push(Filename);
	}
}
PreloadOceanFilenames();
						  
const PreloadPromises =
[
];
let PreloadPromisesFinished = false;

function Update_Logo(FirstUpdate,UpdateDuration,StateTime)
{
	//	setup preloads
	if ( FirstUpdate )
	{
		const Load = function(Filename)
		{
			if ( !Filename )
				return;
			const Promise = Pop.AsyncCacheAssetAsString(Filename);
			PreloadPromises.push( Promise );
		}
		PreloadFilenames.forEach( Load );
		const OnPreloadFinished = function()
		{
			PreloadPromisesFinished = true;
		}
		Promise.all( PreloadPromises ).then( OnPreloadFinished );
	}
	
	//	show button when preloads done
	if ( PreloadPromisesFinished )
	{
		let StartButton = new Pop.Hud.Label('Hint_Start');
		StartButton.SetVisible(true);
	}
	
	//	wait minimum of X secs
	//	todo: and button press
	if ( StateTime < 3 )
	{
		//Pop.Debug("Logo...",StateTime);
		return;
	}
	
	//	wait for preloads
	if ( !PreloadPromisesFinished )
	{
		Pop.Debug("Waiting for preloads...");
		return;
	}
	
	HideLogo();
	return 'Experience';
}


function Update_Experience(FirstUpdate)
{
	if ( FirstUpdate )
	{
		let Source = Pop.LoadFileAsString('AcidicOcean.js');
		Pop.CompileAndRun( Source, 'AcidicOcean.js' );
		
		//	show some elements
		let ShowHud = function(Name)
		{
			let Div = new Pop.Hud.Label(Name);
			Div.SetVisible(true);
		}
		const ShowElements =
		[
		 'AudioMusic',
		 'AudioVoice',
		 'SubtitleLabel',
		 'YearSlider',
		 'Timeline',
		 'Year',
		 'Stats',
		// 'Hint_Headphones',
		 'IconHeadphones',
		 'Hint_TapAnimal',
		 'Hint_ClickAnimal',
		 'Hint_DragTimeline_Mobile',
		 'Hint_DragTimeline_Desktop',
		 'Hint_TouchToInteract',
		 'AnimalCard'
		 ];
		ShowElements.forEach( ShowHud );
	}
}
