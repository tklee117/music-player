# app.py
from flask import Flask, render_template, request, redirect, url_for, jsonify
import os
import json
from urllib.parse import urlparse, parse_qs

app = Flask(__name__)

# Define an absolute path to store songs.json
# This ensures it's saved in a known, persistent location
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SONGS_FILE = os.path.join(BASE_DIR, 'songs.json')


def get_youtube_id(url):
    """Extract YouTube ID from URL"""
    if not url:
        return None
    
    if 'youtu.be' in url:
        return url.split('/')[-1].split('?')[0]
    
    parsed_url = urlparse(url)
    if 'youtube.com' in parsed_url.netloc:
        if 'v' in parse_qs(parsed_url.query):
            return parse_qs(parsed_url.query)['v'][0]
    
    # If it's already just an ID
    if len(url) == 11 and '/' not in url and '?' not in url:
        return url
        
    return None

def load_songs():
    """Load songs from JSON file"""
    try:
        if os.path.exists(SONGS_FILE):
            with open(SONGS_FILE, 'r') as f:
                return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error loading songs: {e}")
    return []

def save_songs(songs):
    """Save songs to JSON file"""
    try:
        # Make sure directory exists
        os.makedirs(os.path.dirname(SONGS_FILE), exist_ok=True)
        with open(SONGS_FILE, 'w') as f:
            json.dump(songs, f, indent=2)
    except IOError as e:
        print(f"Error saving songs: {e}")

def get_youtube_thumbnail(youtube_id):
    return f"https://img.youtube.com/vi/{youtube_id}/hqdefault.jpg"

# Initialize with some default songs if file doesn't exist
if not os.path.exists(SONGS_FILE):
    default_songs = [
        {
            "id": 1,
            "title": "Get You",
            "artist": "Daniel Caesar (feat. Kali Uchis)",
            "youtube_id": "WFLGrpGemLg",
            "cover_url": "https://img.youtube.com/vi/WFLGrpGemLg/0.jpg"
        },
        {
            "id": 2,
            "title": "Give Me Mercy",
            "artist": "The Weeknd",
            "youtube_id": "cVoO8ZYXkrQ",
            "cover_url": "https://img.youtube.com/vi/cVoO8ZYXkrQ/hqdefault.jpg"
        },
        {
            "id": 3,
            "title": "New Year",
            "artist": "Mk.gee",
            "youtube_id": "iGQjD4gOzNM",
            "cover_url": "https://img.youtube.com/vi/iGQjD4gOzNM/hqdefault.jpg"
        },
        {
            "id": 4,
            "title": "Thinkin Bout You",
            "artist": "Frank Ocean",
            "youtube_id": "6JHu3b-pbh8",
            "cover_url": "https://img.youtube.com/vi/6JHu3b-pbh8/hqdefault.jpg"
        },
        {
            "id": 5,
            "title": "Let's go watch the stars",
            "artist": "Jeok-Jae",
            "youtube_id": "Mz031oU0Xfw",
            "cover_url": "https://img.youtube.com/vi/Mz031oU0Xfw/hqdefault.jpg"
        },
        {
            "id": 6,
            "title": "Luther",
            "artist": "Kendrick Lamar (feat. SZA)",
            "youtube_id": "HfWLgELllZs",
            "cover_url": "https://img.youtube.com/vi/HfWLgELllZs/hqdefault.jpg"
        }
    ]
    save_songs(default_songs)

@app.route('/')
def index():
    """Render the main music player page"""
    songs = load_songs()
    
    # Check for newly added song from session
    new_song_id = request.args.get('new_song_id')
    if new_song_id:
        try:
            new_song_id = int(new_song_id)
            # Mark the new song
            for song in songs:
                if song.get('id') == new_song_id:
                    song['is_new_added'] = True
                else:
                    song['is_new_added'] = False
        except ValueError:
            pass
    
    return render_template('index.html', songs=songs)

@app.route('/add_song', methods=['POST'])
def add_song():
    """Add a new song to the playlist"""
    title = request.form.get('title')
    artist = request.form.get('artist')
    youtube_url = request.form.get('youtube_url')
    
    youtube_id = get_youtube_id(youtube_url)
    
    if not youtube_id:
        # Redirect back with error
        return redirect(url_for('index'))
    
    # Load current songs
    songs = load_songs()
    
    # Generate a new ID
    new_id = 1
    if songs:
        new_id = max(song.get('id', 0) for song in songs) + 1
    
    # Create new song
    new_song = {
        "id": new_id,
        "title": title,
        "artist": artist,
        "youtube_id": youtube_id,
        "cover_url": get_youtube_thumbnail(youtube_id)
    }
    
    # Add to list
    songs.append(new_song)
    
    # Save the updated songs list
    save_songs(songs)
    
    # Redirect back with the new song ID
    return redirect(url_for('index', new_song_id=new_id))

@app.route('/remove_song/<int:song_id>', methods=['POST'])
def remove_song(song_id):
    """Remove a song from the playlist"""
    songs = load_songs()
    songs = [song for song in songs if song.get('id') != song_id]
    save_songs(songs)
    return jsonify({"status": "success"})

if __name__ == '__main__':
    app.run(debug=True)