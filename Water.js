
function GenerateGridVertexes(Contents,OnVertex,OnMeta)
{
	const Width = 300;
	const Height = 300;

	//	too slow to sort afterwards, make a list of indexes in a random order
	//	generate indexes, then randomise. Fastest!
	let Coords = Array.from({ length: (Width * Height) },(_,i) => (i + 1));
	Pop.Array.Shuffle(Coords);

	function PushXY(x,y)
	{
		//	offset each point randomly
		let OffsetMax = 0.4;
		let s = Math.Lerp(-OffsetMax,OffsetMax,Math.random());
		let t = Math.Lerp(-OffsetMax,OffsetMax,Math.random());
		s *= 1 / Width;
		t *= 1 / Height;
		let u = Math.lerp(0.2,0.8,x / Width) + s;
		let v = Math.lerp(1.0,0.0,y / Height) + t;
		OnVertex(u,0,v);
	}

	for (let i = 0;i < Coords.length;i++)
	{
		const xy_index = Coords[i];
		let x = xy_index % Width;
		let y = xy_index / Width;
		PushXY(x,y);
	}
}

function GetWaterMeta()
{
	const Meta = {};
	Meta.AddNoiseToTextureBuffer = false;
	Meta.LocalScale = 1;
	Meta.Filename = 'GenerateGridVertexes()';
	
	Meta.RenderShader = WaterParticleShader;
	Meta.RenderUniforms = {};
	Meta.RenderUniforms.NoiseImage = Noise_TurbulenceTexture;
	function PushParam(Name)
	{
		Meta.RenderUniforms[Name] = Params[Name];
	}
	const WaterParams =
	[
	'Water_TimeScale',
	'Water_PosScale',
	'Water_HeightScale',
	'Wave1_Amplitude',
	'Wave1_Frequency',
	'Wave1_DirX',
	'Wave1_DirZ',
	'Wave1_Phase',
	'Wave1_Sharpness',
	'Wave2_Amplitude',
	'Wave2_Frequency',
	'Wave2_DirX',
	'Wave2_DirZ',
	'Wave2_Phase',
	'Wave2_Sharpness',
	'Wave3_Amplitude',
	'Wave3_Frequency',
	'Wave3_DirX',
	'Wave3_DirZ',
	'Wave3_Phase',
	'Wave3_Sharpness',
	];
	WaterParams.forEach( PushParam );
	

	Meta.PhysicsNoiseScale = 0;
	Meta.PhysicsDamping = 1;
	
	Meta.RenderUniforms.TriangleScale = Params.Ocean_TriangleScale;
	
	if ( OceanColourTexture.Pixels )
		Meta.OverridingColourTexture = OceanColourTexture;
	
	Meta.RenderTimeIsRealTime = true;
	Meta.FitToBoundingBox = true;
	Meta.ForceBoundsY = 1;

	//Pop.Debug("GetWaterMeta",Meta);

	return Meta;
}
