
function LoadAnimalDatabase(Filename)
{
	const DatabaseContents = Pop.LoadFileAsString(Filename);
	const DatabaseJson = JSON.parse( DatabaseContents );
	return DatabaseJson;
}

const AnimalDatabase = LoadAnimalDatabase('Animals.json');

//	to debug, load them in order (rather than "random")
let AnimalUsageCounter = 0;
//	debug, force one model to load
const ForceRandomAnimal = null;//"PLASTIC BAG";

function GetRandomAnimal(NodeName)
{
	const Category = NodeName;
	
	if ( ForceRandomAnimal )
		return AnimalDatabase[ForceRandomAnimal];

	//	if second half of node name matches an animal, use that explicitly
	try
	{
		const NodeAnimalName = NodeName.split('_')[1];
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
		AnimalNames = Object.keys(AnimalDatabase);
	
	const AnimalIndex = Math.floor( Math.random() * AnimalNames.length );
	//const AnimalIndex = (AnimalUsageCounter++) % AnimalNames.length;
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
	Meta.LocalScale = 1;
	Meta.Filename = OceanFilenames;
	Meta.RenderShader = AnimalParticleShader;
	Meta.PhysicsNoiseScale = 0;
	Meta.PhysicsDamping = 1;
	Meta.TriangleScale = Params.Ocean_TriangleScale;
	if ( OceanColourTexture.Pixels )
		Meta.OverridingColourTexture = OceanColourTexture;
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



