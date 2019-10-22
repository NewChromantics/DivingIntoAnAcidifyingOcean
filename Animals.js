
function LoadAnimalDatabase(Filename)
{
	const DatabaseContents = Pop.LoadFileAsString(Filename);
	const DatabaseJson = JSON.parse( DatabaseContents );
	return DatabaseJson;
}

const AnimalDatabase = LoadAnimalDatabase('Animals.json');

//	debug, force one model to load
const ForceRandomAnimal = null;//"PLASTIC BAG";

function GetRandomAnimal(NodeName)
{
	//Pop.Debug("GetRandomAnimal("+NodeName+")");
	const Category = NodeName;
	
	if ( ForceRandomAnimal )
		return AnimalDatabase[ForceRandomAnimal];

	//	if second half of node name matches an animal, use that explicitly
	let NodeAnimalName = null;
	try
	{
		//	grab last part, if it's an animal name, use it
		NodeAnimalName = NodeName.split('_').slice(-1)[0];
		if ( AnimalDatabase.hasOwnProperty(NodeAnimalName) )
			return AnimalDatabase[NodeAnimalName];
	}
	catch(e)
	{
		Pop.Debug("Error getting specific animal name from",NodeName);
	}
	
	function FilterByCategory(AnimalName)
	{
		const Animal = AnimalDatabase[AnimalName];
		const MatchedCategory = Animal.Categorys.some( c => Category.startsWith( c ) );
		return MatchedCategory;
	}
	
	//	get animals that fit category to choose from
	let AnimalNames = Object.keys(AnimalDatabase);
	AnimalNames = AnimalNames.filter( FilterByCategory );
	
	//	if no matches, pick any
	if ( AnimalNames.length == 0 )
	{
		Pop.Debug("GetRandomAnimal("+NodeName+") didn't match any, picking random");
		AnimalNames = Object.keys(AnimalDatabase);
	}
	
	let AnimalIndex = parseInt(NodeAnimalName);
	
	if ( isNaN(AnimalIndex) )
	{
		Pop.Debug("GetRandomAnimal("+NodeName+") isn't an index, picking random, picking random");
		AnimalIndex = Math.floor( Math.random() * AnimalNames.length );
	}
	
	const AnimalName = AnimalNames[AnimalIndex];
	const Animal = AnimalDatabase[AnimalName];
	return Animal;
}

function GetAnimalAssetFilenames()
{
	const Filenames = [];
	const AnimalKeys = Object.keys(AnimalDatabase);
	AnimalKeys.forEach( AnimalName => Filenames.push( AnimalDatabase[AnimalName].Model ) );
	return Filenames;
}




const OceanActorPrefix = 'Ocean_surface_';
const WaterActorPrefix = 'WaterSurface_';
const DebrisActorPrefix = 'Water_';
const NastyAnimalPrefix = 'Nasty_Animal_';
const BigBangAnimalPrefix = 'Bigbang_';
const NormalAnimalPrefix = 'Animal_';
const SwirlActorPrefix = 'Swirl_';
const DustActorPrefix = 'Dust';
const AnimalActorPrefixs = [NormalAnimalPrefix,BigBangAnimalPrefix,NastyAnimalPrefix];


//	store this somewhere else so the preload matches
var OceanFilenames = [];
let LoadOceanFrames = 96;
if ( Pop.GetExeArguments().includes('ShortOcean') )
	LoadOceanFrames = 4;
for ( let i=1;	i<=LoadOceanFrames;	i++ )
	OceanFilenames.push('Ocean/ocean_pts.' + (''+i).padStart(4,'0') + '.ply');



function GetDebrisMeta(Actor)
{
	const Meta = {};
	
	Meta.LocalScale = 1;
	
	Meta.Filename = '.random';
	Meta.RenderShader = AnimalParticleShader;
	Meta.VelocityShader = UpdateVelocityShader;
	Meta.PositionShader = UpdatePositionShader;
	
	Meta.PhysicsUniforms = {};
	Meta.PhysicsUniforms.NoiseScale = Params.Debris_PhysicsNoiseScale;
	Meta.PhysicsUniforms.Damping = Params.Debris_PhysicsDamping;
	Meta.PhysicsUniforms.Noise = RandomTexture;
	
	Meta.TriangleScale = Params.Debris_TriangleScale;
	if ( DebrisColourTexture.Pixels )
		Meta.OverridingColourTexture = DebrisColourTexture;
	
	Meta.FitToBoundingBox = true;
	return Meta;
}

function GetAnimalMeta(Actor)
{
	const Meta = {};
	
	Meta.LocalScale = Params.AnimalScale;
	if ( Actor && Actor.Animal && Actor.Animal.Scale !== undefined )
		Meta.LocalScale = Actor.Animal.Scale;
	
	Meta.LocalFlip = false;
	if ( Actor && Actor.Animal && Actor.Animal.LocalFlip !== undefined )
		Meta.LocalFlip = Actor.Animal.Flip;
	
	Meta.RenderShader = AnimalParticleShader;
	Meta.VelocityShader = UpdateVelocityShader;
	Meta.PositionShader = UpdatePositionShader;
	
	Meta.PhysicsUniforms = {};
	Meta.PhysicsUniforms.NoiseScale = Params.Animal_PhysicsNoiseScale;
	Meta.PhysicsUniforms.Damping = Params.Animal_PhysicsDamping;
	Meta.PhysicsUniforms.Noise = Noise_TurbulenceTexture;
	Meta.PhysicsUniforms.TinyNoiseScale = 0.1;
	
	Meta.TriangleScale = Params.Animal_TriangleScale;
	if ( Actor && Actor.Animal && Actor.Animal.TriangleScale !== undefined )
		Meta.TriangleScale = Actor.Animal.TriangleScale;
	
	Meta.Colours = [InvalidColour];
	return Meta;
}

function GetNastyAnimalMeta(Actor)
{
	let Meta = GetAnimalMeta(Actor);
	
	Meta.VelocityShader = UpdateVelocityPulseShader;
	Meta.PositionShader = UpdatePositionShader;
	
	Meta.PhysicsUniforms.NoiseScale = Params.NastyAnimal_PhysicsNoiseScale;
	Meta.PhysicsUniforms.SpringScale = Params.NastyAnimal_PhysicsSpringScale;
	Meta.PhysicsUniforms.Damping = Params.NastyAnimal_PhysicsDamping;
	Meta.PhysicsUniforms.ExplodeScale = Params.NastyAnimal_PhysicsExplodeScale;
	
	return Meta;
}


function GetBigBangAnimalMeta(Actor)
{
	let Meta = GetAnimalMeta(Actor);
	
	Meta.PhysicsUniforms.Noise = RandomTexture;
	Meta.PhysicsUniforms.Damping = Params.BigBang_Damping;
	Meta.PhysicsUniforms.NoiseScale = Params.BigBang_NoiseScale;
	Meta.PhysicsUniforms.TinyNoiseScale = Params.BigBang_TinyNoiseScale;
	
	return Meta;
}

function GetOceanMeta()
{
	const Meta = {};
	Meta.AddNoiseToTextureBuffer = false;
	Meta.LocalScale = 1;
	Meta.Filename = OceanFilenames;
	Meta.RenderShader = AnimalParticleShader;
	
	Meta.PhysicsNoiseScale = 0;
	Meta.PhysicsDamping = 1;
	
	Meta.TriangleScale = Params.Ocean_TriangleScale;
	if ( OceanColourTexture.Pixels )
		Meta.OverridingColourTexture = OceanColourTexture;
	
	Meta.RenderTimeIsRealTime = true;
	
	
	return Meta;
}

function GenerateGridVertexes(Contents,OnVertex,OnMeta)
{
	const Width = 300;
	const Height = 300;
	
	//	too slow to sort afterwards, make a list of indexes in a random order
	//	generate indexes, then randomise. Fastest!
	let Coords = Array.from( {length:(Width*Height)}, (_,i) => (i+1) );
	Pop.Array.Shuffle(Coords);

	function PushXY(x,y)
	{
		//	offset each point randomly
		let OffsetMax = 0.4;
		let s = Math.Lerp( -OffsetMax, OffsetMax, Math.random() );
		let t = Math.Lerp( -OffsetMax, OffsetMax, Math.random() );
		s *= 1 / Width;
		t *= 1 / Height;
		let u = Math.lerp( 0.2, 0.8, x / Width ) + s;
		let v = Math.lerp( 1.0, 0.4, y / Height ) + t;
		OnVertex( u,0,v );
	}
	
	for ( let i=0;	i<Coords.length;	i++ )
	{
		const xy_index = Coords[i];
		let x = xy_index % Width;
		let y = xy_index / Width;
		PushXY( x, y );
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
	
	Meta.TriangleScale = Params.Ocean_TriangleScale;
	if ( OceanColourTexture.Pixels )
		Meta.OverridingColourTexture = OceanColourTexture;
	
	Meta.RenderTimeIsRealTime = true;
	Meta.FitToBoundingBox = true;
	Meta.ForceBoundsY = 1;
	
	return Meta;
}

function GetDustMeta(Actor)
{
	const Meta = {};
	
	Meta.LocalScale = 1;
	
	Meta.Filename = '.random';
	Meta.RenderShader = DustParticleShader;
	//Meta.VelocityShader = UpdateVelocityShader;
	//Meta.PositionShader = UpdatePositionShader;
	Meta.RenderUniforms = {};
	Meta.RenderUniforms.ShiftDustParticles = Params.ShiftDustParticles;
	Meta.RenderUniforms.DustParticlesBounds = [Params.DustParticles_BoundsX,Params.DustParticles_BoundsY,Params.DustParticles_BoundsZ];
	Meta.RenderUniforms.DustParticlesOffset = Params.DustParticles_OffsetZ;
	
	Meta.PhysicsUniforms = {};
	Meta.PhysicsUniforms.NoiseScale = Params.Debris_PhysicsNoiseScale;
	Meta.PhysicsUniforms.Damping = Params.Debris_PhysicsDamping;
	Meta.PhysicsUniforms.Noise = RandomTexture;
	
	Meta.TriangleScale = Params.Debris_TriangleScale;
	if ( DebrisColourTexture.Pixels )
		Meta.OverridingColourTexture = DebrisColourTexture;
	
	Meta.FitToBoundingBox = false;
	return Meta;
}



