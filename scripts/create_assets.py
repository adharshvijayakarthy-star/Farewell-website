"""Reproducible original Blender hero assets. Run blender -b --python scripts/create_assets.py."""
import bpy, math, os
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public','models');os.makedirs(OUT,exist_ok=True)
SOURCE=os.path.join(ROOT,'assets','blender');os.makedirs(SOURCE,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def material(name,color,metallic,roughness):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metallic;p.inputs['Roughness'].default_value=roughness
 return m
pearl=material('Iridescent pearl',(0.73,0.57,0.86),.72,.2)
gold=material('Champagne chrome',(.8,.58,.27),.87,.18)
chrome=material('Liquid silver',(.68,.78,.92),.95,.14)
def export(name):
 bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SOURCE,name+'.blend'))
 bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=False)
def clear():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
# Sculpted double whorl with curved, tapered, folded petals; baked mesh requires no modifiers at runtime.
for ring in range(2):
 for petal in range(9):
  angle=petal*math.tau/9+ring*.28;verts=[];faces=[]
  for i in range(15):
   u=i/14;r=.14+u*(1.9-ring*.5);width=math.sin(math.pi*u)**.7*(.51-ring*.1)
   for j in range(7):
    v=(j/6*2-1);x=r;y=v*width;z=.25*math.sin(u*math.pi*1.5)+.26*v*v+.22*ring+.15*u*u
    verts.append((x*math.cos(angle)-y*math.sin(angle),x*math.sin(angle)+y*math.cos(angle),z))
  for i in range(14):
   for j in range(6):
    a=i*7+j;faces.append((a,a+1,a+8,a+7))
  mesh=bpy.data.meshes.new('Sculpted petal');mesh.from_pydata(verts,[],faces);mesh.update()
  obj=bpy.data.objects.new('Pearl petal',mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(pearl)
  for p in mesh.polygons:p.use_smooth=True
  solid=obj.modifiers.new('Petal thickness','SOLIDIFY');solid.thickness=.014
  bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=solid.name)
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=.24);bpy.context.object.data.materials.append(gold)
export('celestial-flower');clear()
# Tiled sphere: a true mirror-ball surface with individual beveled mirror facets.
verts=[];faces=[]
for row in range(1,31):
 theta0=math.pi*row/32+.006;theta1=math.pi*(row+1)/32-.006
 for col in range(64):
  p0=math.tau*col/64+.005;p1=math.tau*(col+1)/64-.005
  k=len(verts)
  for t,p in [(theta0,p0),(theta0,p1),(theta1,p1),(theta1,p0)]:verts.append((math.sin(t)*math.cos(p),math.sin(t)*math.sin(p),math.cos(t)))
  faces.append((k,k+1,k+2,k+3))
mesh=bpy.data.meshes.new('Mirror mosaic');mesh.from_pydata(verts,[],faces);mesh.update()
obj=bpy.data.objects.new('Disco mirror facets',mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(chrome)
export('disco-ball')
print('Original celestial GLB assets exported.')
