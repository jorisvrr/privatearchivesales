"""Builds public/media/sound/*.m4a from three CC0 Freesound recordings (see public/media/sound/CREDITS.md).
Usage: python3 scripts/process-sounds.py <work-dir>
Downloads the public HQ previews into <work-dir>, then: cut → filter → trim leading silence → fades →
balance perceived loudness (BS.1770 K-weighted, measured over the active part) → WebM/Opus 96 kb/s and AAC 128 kb/s.
Levels: paper −22 LUFS, fabric −21 LUFS, click −30 LUFS (quietest), all with ≥1 dB peak headroom."""
import numpy as np, wave, subprocess, json, sys, os, urllib.request
D = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'media', 'sound')
PREVIEWS = {
  '182889': 'https://cdn.freesound.org/previews/182/182889_1362440-hq.mp3',
  '580967': 'https://cdn.freesound.org/previews/580/580967_13110737-hq.mp3',
  '740266': 'https://cdn.freesound.org/previews/740/740266_14631530-hq.mp3',
}
os.makedirs(f'{D}/wav', exist_ok=True); os.makedirs(f'{D}/proc', exist_ok=True)
for sid, url in PREVIEWS.items():
    mp3 = f'{D}/{sid}.mp3'
    if not os.path.exists(mp3):
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (asset build script)'})
        open(mp3, 'wb').write(urllib.request.urlopen(req).read())
    subprocess.run(['ffmpeg','-v','error','-y','-i',mp3,'-ac','1','-ar','48000',f'{D}/wav/{sid}.wav'],check=True)
def load(p):
    w=wave.open(p); return np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float64)/32768, w.getframerate()
def save(p,x,sr):
    w=wave.open(p,'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((np.clip(x,-1,1)*32767).astype(np.int16).tobytes()); w.close()
def biquad(x,b,a):
    y=np.zeros_like(x); x1=x2=y1=y2=0.0
    for i,v in enumerate(x):
        o=b[0]*v+b[1]*x1+b[2]*x2-a[1]*y1-a[2]*y2; x2,x1=x1,v; y2,y1=y1,o; y[i]=o
    return y
def lufs_active(x):
    # BS.1770 K-weighting (48 kHz), measured over the part within 20 dB of the clip's loudest 50 ms.
    y=biquad(x,[1.53512485958697,-2.69169618940638,1.19839281085285],[1,-1.69065929318241,0.73248077421585])
    y=biquad(y,[1.0,-2.0,1.0],[1,-1.99004745483398,0.99007225036621])
    h=2400; blocks=[np.mean(y[i:i+h]**2) for i in range(0,max(1,len(y)-h+1),h//4)]
    blocks=np.array(blocks); top=blocks.max(); act=blocks[blocks>top*0.01]
    return -0.691+10*np.log10(act.mean()+1e-12)
def onset(x,sr,rel=0.05):
    env=np.abs(x); return int(np.argmax(env>env.max()*rel))
spec = {
  'paper-shuffle': dict(src='182889', start=7.05, dur=0.80, pre='highpass=f=150,agate=threshold=0.02:ratio=4:attack=0.5:release=50,acompressor=threshold=-24dB:ratio=6:attack=0.5:release=80:makeup=1', target=-21.0, fade_out=0.10, onset=0.3, maxlen=0.62),
  'fabric-sweep':  dict(src='580967', start=10.00, dur=0.60, pre='highpass=f=70', target=-21.0, fade_out=0.15),
  'garment-click': dict(src='740266', start=0.60, dur=0.12, pre='highpass=f=120,lowpass=f=3200', target=-30.0, fade_out=0.05),
}
report={}
for name,s in spec.items():
    tmp=f'{D}/proc/{name}-cut.wav'
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(s['start']),'-t',str(s['dur']),'-i',f'{D}/wav/{s["src"]}.wav','-af',s['pre'],'-ac','1','-ar','48000',tmp],check=True)
    x,sr=load(tmp)
    i=max(0,onset(x,sr,s.get('onset',0.05))-int(0.004*sr)); x=x[i:]                     # trim leading silence (keep 4 ms)
    if s.get('maxlen'): x=x[:int(s['maxlen']*sr)]
    n_in=int(0.003*sr); x[:n_in]*=np.linspace(0,1,n_in)            # 3 ms fade in
    n_out=int(s['fade_out']*sr); x[-n_out:]*=np.linspace(1,0,n_out)**2
    L=lufs_active(x); g=10**((s['target']-L)/20); x=x*g
    pk=np.abs(x).max()
    if pk>0.89: x*=0.89/pk                                          # keep ≥1 dB headroom
    final=f'{D}/proc/{name}.wav'; save(final,x,sr)
    subprocess.run(['ffmpeg','-v','error','-y','-i',final,'-c:a','aac','-b:a','128k',f'{OUT}/{name}.m4a'],check=True)
    subprocess.run(['ffmpeg','-v','error','-y','-i',final,'-c:a','libopus','-b:a','96k',f'{OUT}/{name}.webm'],check=True)
    report[name]=dict(lufs=round(lufs_active(x),1),peak_db=round(20*np.log10(np.abs(x).max()),1),dur=round(len(x)/sr,3),trimmed_ms=round(i/sr*1000,1))
print(json.dumps(report,indent=1))
