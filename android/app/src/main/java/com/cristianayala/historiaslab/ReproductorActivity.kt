package com.cristianayala.historiaslab

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.widget.ImageView
import androidx.annotation.OptIn
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.bumptech.glide.Glide
import java.util.ArrayList

class ReproductorActivity : AppCompatActivity() {

    private var player: ExoPlayer? = null
    private lateinit var playerView: PlayerView
    private lateinit var imagenView: ImageView

    private var listaUrls: ArrayList<String> = ArrayList()
    private var listaTipos: ArrayList<String> = ArrayList()
    private var listaThumbnails: ArrayList<String> = ArrayList()
    
    private var posicionActual = 0
    private val handlerTemporizador = Handler(Looper.getMainLooper())
    private val runnableFoto = Runnable { pasarSiguienteHistoria() }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_reproductor)

        playerView = findViewById(R.id.playerView)
        imagenView = findViewById(R.id.imagenView)

        listaUrls = intent.getStringArrayListExtra("LISTA_URLS") ?: ArrayList()
        listaTipos = intent.getStringArrayListExtra("LISTA_TIPOS") ?: ArrayList()
        listaThumbnails = intent.getStringArrayListExtra("LISTA_THUMBNAILS") ?: ArrayList()

        if (listaUrls.isNotEmpty()) {
            cargarHistoria(posicionActual)
        } else {
            finish()
        }
    }

    private fun cargarHistoria(index: Int) {
        handlerTemporizador.removeCallbacks(runnableFoto)

        if (index >= listaUrls.size) {
            finish()
            return
        }

        val url = listaUrls[index]
        val tipo = listaTipos[index]
        
        Log.d("REPRODUCTOR_DEBUG", "Cargando historia $index, Tipo: $tipo, URL: $url")

        val urlThumbnail = if (index < listaThumbnails.size) listaThumbnails[index] else url

        imagenView.visibility = View.VISIBLE
        Glide.with(this).load(urlThumbnail).into(imagenView)

        if (tipo == "foto") {
            playerView.visibility = View.GONE
            handlerTemporizador.postDelayed(runnableFoto, 5000)
        } else {
            playerView.visibility = View.VISIBLE
            initializePlayer(url) 
        }
    }

    @OptIn(UnstableApi::class)
    private fun initializePlayer(url: String) {
        player?.release()
        player = null

        player = ExoPlayer.Builder(this).build().also { exoPlayer ->
            playerView.player = exoPlayer
            playerView.useController = false
            exoPlayer.repeatMode = Player.REPEAT_MODE_OFF

            exoPlayer.addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(state: Int) {
                    if (state == Player.STATE_READY) {
                        imagenView.visibility = View.GONE
                        player?.play()
                    }
                    if (state == Player.STATE_ENDED) {
                        pasarSiguienteHistoria()
                    }
                }
                override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                    Log.e("ReproductorActivity", "Error de ExoPlayer: ${error.message}")
                    pasarSiguienteHistoria()
                }
            })
        }

        // Si la URL es una ruta relativa de Firebase, aquí podrías necesitar convertirla a URL completa
        // Por ahora, intentaremos cargarla directamente:
        val mediaItem = if (url.contains(".m3u8")) {
            MediaItem.Builder()
                .setUri(url)
                .setMimeType(MimeTypes.APPLICATION_M3U8)
                .build()
        } else {
            MediaItem.fromUri(url)
        }

        player?.apply {
            setMediaItem(mediaItem)
            prepare()
            playWhenReady = true
        }
    }

    private fun pasarSiguienteHistoria() {
        posicionActual++
        cargarHistoria(posicionActual)
    }

    override fun onDestroy() {
        super.onDestroy()
        handlerTemporizador.removeCallbacks(runnableFoto)
        player?.release()
        player = null
    }
}